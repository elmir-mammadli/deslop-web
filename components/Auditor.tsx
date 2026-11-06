"use client";

import Script from "next/script";
import { useRef, useState } from "react";
import { TELL_BY_ID } from "@/lib/tells";
import type { Crop, PagePayload, SavedReport } from "@/lib/types";
import { PageSketch, ProgressRule, SiteSketch } from "./PageSketch";
import Report from "./Report";
import s from "./auditor.module.css";

type Row = { url: string; status: "waiting" | "running" | "done" | "failed"; note?: string; clean?: boolean };
type Phase = "idle" | "discovering" | "running" | "done";

const CONCURRENCY = 2;
const TURNSTILE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

const pathOf = (url: string) => {
  try {
    const u = new URL(url);
    return u.pathname + u.search || "/";
  } catch {
    return url;
  }
};

async function post<T>(path: string, body: unknown, signal: AbortSignal): Promise<T> {
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal });
  const data = await res.json().catch(() => ({ error: "The server sent an unreadable answer." }));
  if (!res.ok) throw new Error(data.error || `Request failed with status ${res.status}`);
  return data as T;
}

/** Keep the clearest examples: two per tell across the whole site, fix-level tells first. */
function pickCrops(payloads: PagePayload[]): Crop[] {
  const all = payloads.flatMap((p) => p.crops);
  const per: Record<string, number> = {};
  return all
    .sort((a, b) => (TELL_BY_ID[b.tell]?.weight ?? 0) - (TELL_BY_ID[a.tell]?.weight ?? 0))
    .filter((c) => {
      per[c.tell] = (per[c.tell] || 0) + 1;
      return per[c.tell] <= 2;
    });
}

export default function Auditor({ children, canShare }: { children?: React.ReactNode; canShare: boolean }) {
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [site, setSite] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [payloads, setPayloads] = useState<PagePayload[]>([]);
  const abort = useRef<AbortController | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const update = (url: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.url === url ? { ...r, ...patch } : r)));

  async function start(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    const ctrl = new AbortController();
    abort.current = ctrl;
    setError(null);
    setNote(null);
    setPayloads([]);
    setRows([]);
    setPhase("discovering");
    const token = formRef.current ? (new FormData(formRef.current).get("cf-turnstile-response") as string | null) : null;

    let found: { site: string; pages: string[]; note: string | null };
    try {
      found = await post("/api/discover", { url: input, token }, ctrl.signal);
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setError((err as Error).message);
      setPhase("idle");
      return;
    }
    setSite(found.site);
    setNote(found.note);
    setRows(found.pages.map((url) => ({ url, status: "waiting" })));
    setPhase("running");

    const results: PagePayload[] = [];
    const queue = [...found.pages];
    async function worker() {
      while (queue.length && !ctrl.signal.aborted) {
        const url = queue.shift() as string;
        update(url, { status: "running" });
        try {
          const p = await post<PagePayload>("/api/audit", { url }, ctrl.signal);
          results.push(p);
          setPayloads([...results]);
          const n = Object.values(p.result.counts).reduce((a, b) => a + b, 0);
          update(url, { status: "done", clean: !n, note: n ? `${n} finding${n === 1 ? "" : "s"}` : "nothing found" });
        } catch (err) {
          if (ctrl.signal.aborted) return;
          update(url, { status: "failed", note: (err as Error).message });
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    if (ctrl.signal.aborted) return;
    if (!results.length) {
      setError("None of the pages could be audited. The site may block automated browsers.");
      setPhase("idle");
      return;
    }
    // keep the discovery order so the home page comes first
    results.sort((a, b) => found.pages.indexOf(a.result.url) - found.pages.indexOf(b.result.url));
    setPayloads(results);
    setPhase("done");
    window.scrollTo({ top: 0 });
  }

  function cancel() {
    abort.current?.abort();
    setPhase("idle");
  }

  if (phase === "done") {
    const view: Omit<SavedReport, "id"> = {
      site,
      createdAt: new Date().toISOString(),
      pages: payloads.map((p) => p.result),
      crops: pickCrops(payloads),
      thumbs: Object.fromEntries(payloads.filter((p) => p.thumb).map((p) => [p.result.url, p.thumb as string])),
    };
    return <Report view={view} payloads={canShare ? payloads : undefined} note={note} onRestart={() => setPhase("idle")} />;
  }

  if (phase === "discovering" || phase === "running") {
    const done = rows.filter((r) => r.status === "done" || r.status === "failed").length;
    return (
      <main className={`wrap ${s.progress}`} aria-live="polite">
        <h1 className={s.progressTitle}>{phase === "discovering" ? "Finding pages" : `Auditing ${site}`}</h1>
        <p className={s.progressLede}>
          {phase === "discovering"
            ? "Reading the home page, the sitemap and robots.txt."
            : `${done} of ${rows.length} pages done. Each page opens in a real browser at desktop width, scrolls to the end, and is read element by element.`}
        </p>
        {note && <p className={s.progressNote}>{note}</p>}
        {phase === "discovering" && (
          <div className={s.discover}>
            <SiteSketch />
          </div>
        )}
        {phase === "running" && <ProgressRule done={done} total={rows.length} />}
        {rows.length > 0 && (
          <ol className={s.rows}>
            {rows.map((r) => (
              <li key={r.url} className={s.row} data-status={r.status}>
                <PageSketch status={r.status} clean={r.clean} />
                <span className={s.rowPath}>{pathOf(r.url)}</span>
                <span className={s.rowStatus}>
                  {r.status === "waiting" && "Waiting"}
                  {r.status === "running" && "Reading the page"}
                  {r.status === "done" && r.note}
                  {r.status === "failed" && `Skipped: ${r.note}`}
                </span>
              </li>
            ))}
          </ol>
        )}
        <button type="button" className="btn btnLine" onClick={cancel}>
          Stop
        </button>
      </main>
    );
  }

  return (
    <main>
      <section className={`wrap ${s.hero}`}>
        <h1 className={s.title}>How generated does your website look?</h1>
        <div className={s.side}>
          <p className={s.lede}>
            Deslop opens the main pages of a site in a real browser, reads what is on screen, and marks every tell that makes
            it look AI-made. You get a score out of 100 and the exact fix for each tell.
          </p>
          <form ref={formRef} className={s.form} onSubmit={start}>
            <label htmlFor="site" className={s.label}>
              Website address
            </label>
            <div className={s.field}>
              <input
                id="site"
                name="site"
                className={s.input}
                type="text"
                inputMode="url"
                autoComplete="url"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="yourbusiness.com"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                required
              />
              <button className="btn" type="submit">
                Audit site
              </button>
            </div>
            {TURNSTILE_KEY && (
              <>
                <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
                <div className="cf-turnstile" data-sitekey={TURNSTILE_KEY} data-size="flexible" />
              </>
            )}
            {error && (
              <p className={s.error} role="alert">
                {error}
              </p>
            )}
            <p className={s.hint}>Takes one to three minutes for up to 12 pages.</p>
          </form>
        </div>
      </section>
      {children}
    </main>
  );
}
