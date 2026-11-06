"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { fixPrompt } from "@/lib/prompt";
import { band, scoreSite, type TellScore } from "@/lib/score";
import type { Crop, PagePayload, PageResult, SavedReport } from "@/lib/types";
import s from "./report.module.css";

type Props = {
  view: Omit<SavedReport, "id">;
  /** Present right after a live audit; needed to save a share link. */
  payloads?: PagePayload[];
  savedId?: string;
  note?: string | null;
  onRestart?: () => void;
};

const AI_FONT = /instrument|geist|space grotesk|ibm plex mono|jetbrains mono|space mono/i;

const pathOf = (url: string) => {
  try {
    return new URL(url).pathname || "/";
  } catch {
    return url;
  }
};

function ScoreMark({ score }: { score: number }) {
  const b = band(score);
  return (
    <div className={s.scoreMark} data-band={b.id}>
      <svg className={s.scoreRing} viewBox="0 0 220 150" aria-hidden="true">
        <path d="M36 82 C 28 36, 160 14, 192 58 C 216 92, 170 136, 104 136 C 44 136, 14 104, 34 64 C 46 42, 82 28, 118 26" />
      </svg>
      <span className={s.scoreNumber}>{score}</span>
      <span className="visuallyHidden"> out of 100</span>
    </div>
  );
}

function CropFigure({ crop }: { crop: Crop }) {
  const pct = (v: number, of: number) => `${(v / of) * 100}%`;
  return (
    <figure className={s.crop} style={{ flex: `1 1 ${Math.min(crop.width, 420)}px`, maxWidth: crop.width }}>
      <div className={s.cropFrame} style={{ aspectRatio: `${crop.width} / ${crop.height}` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={crop.src} width={crop.width} height={crop.height} alt={`Screenshot: ${crop.text || crop.path}`} loading="lazy" />
        <span
          className={s.cropBox}
          style={{ left: pct(crop.box.x, crop.width), top: pct(crop.box.y, crop.height), width: pct(crop.box.w, crop.width), height: pct(crop.box.h, crop.height) }}
        />
      </div>
    </figure>
  );
}

function TellBlock({ t, pages, crops, total }: { t: TellScore; pages: PageResult[]; crops: Crop[]; total: number }) {
  const examples = pages.flatMap((p) => p.findings.filter((f) => f.tell === t.tell.id).map((f) => ({ ...f, page: pathOf(p.url) })));
  return (
    <article className={s.tell}>
      <header className={s.tellHead}>
        <h3 className={s.tellName}>{t.tell.name}</h3>
        <p className={s.tellMeta}>
          {t.instances} on {t.pages.length} of {total} page{total === 1 ? "" : "s"} · tell {t.tell.skill}
        </p>
      </header>
      <p className={s.why}>{t.tell.why}</p>
      {crops.length > 0 && (
        <div className={s.crops}>
          {crops.map((c, i) => (
            <CropFigure key={i} crop={c} />
          ))}
        </div>
      )}
      <dl className={s.rule}>
        <dt>Fix</dt>
        <dd>{t.tell.action}</dd>
        <dt>Keep when</dt>
        <dd>{t.tell.keep}</dd>
      </dl>
      {examples.length > 0 && (
        <details className={s.where}>
          <summary>Where it appears</summary>
          <ul>
            {examples.slice(0, 20).map((e, i) => (
              <li key={i}>
                <span className={s.wherePage}>{e.page}</span> {e.text ? <q>{e.text.slice(0, 120)}</q> : null}
                <span className={s.whereDetail}>
                  {e.detail}
                  {e.path && (
                    <>
                      {" · "}
                      <code>{e.path}</code>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {examples.length > 20 && <p className={s.whereMore}>And {examples.length - 20} more.</p>}
        </details>
      )}
    </article>
  );
}

export default function Report({ view, payloads, savedId, note, onRestart }: Props) {
  const score = useMemo(() => scoreSite(view.pages), [view.pages]);
  const [copied, setCopied] = useState(false);
  const [share, setShare] = useState<{ state: "idle" | "saving" | "done" | "error"; url?: string; error?: string }>(
    savedId ? { state: "done", url: `/r/${savedId}` } : { state: "idle" },
  );
  const b = band(score.overall);
  const fixes = score.tells.filter((t) => t.tell.level === "fix");
  const reviews = score.tells.filter((t) => t.tell.level === "review");
  const prompt = useMemo(() => fixPrompt(view.site, view.pages, score), [view, score]);
  const date = new Date(view.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const fonts = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const p of view.pages) for (const f of p.fonts) acc[f.family] = (acc[f.family] || 0) + f.share / view.pages.length;
    return Object.entries(acc)
      .sort((a, b) => b[1] - a[1])
      .filter(([, v]) => v >= 0.02)
      .slice(0, 5);
  }, [view.pages]);

  async function copyPrompt() {
    await navigator.clipboard.writeText(prompt).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  async function makeLink() {
    if (!payloads) return;
    setShare({ state: "saving" });
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ site: view.site, pages: payloads.map(({ result, sig }) => ({ result, sig })), crops: view.crops, thumbs: view.thumbs }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Saving failed.");
      const url = `/r/${data.id}`;
      window.history.replaceState(null, "", url);
      await navigator.clipboard.writeText(window.location.origin + url).catch(() => {});
      setShare({ state: "done", url });
    } catch (e) {
      setShare({ state: "error", error: (e as Error).message });
    }
  }

  function download() {
    const data = { site: view.site, auditedAt: view.createdAt, score: score.overall, categories: score.categories, tells: score.tells.map((t) => ({ id: t.tell.id, name: t.tell.name, level: t.tell.level, instances: t.instances, pages: t.pages })), pages: view.pages };
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    a.download = `deslop-${view.site}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const cropsFor = (id: string) => view.crops.filter((c) => c.tell === id).slice(0, 2);

  return (
    <main className={`wrap ${s.report}`}>
      <section className={s.summary} aria-labelledby="report-title">
        <div className={s.summaryText}>
          <h1 id="report-title" className={s.site}>
            {view.site}
          </h1>
          <p className={s.meta}>
            Audited {date} · {view.pages.length} page{view.pages.length === 1 ? "" : "s"} at desktop width
          </p>
          <p className={s.verdict} data-band={b.id}>
            {b.label}
          </p>
          <p className={s.verdictLine}>
            {fixes.length === 0 && reviews.length === 0
              ? "No tells found on the pages audited."
              : `${fixes.length} tell${fixes.length === 1 ? "" : "s"} to fix and ${reviews.length} to review.`}
          </p>
          {note && <p className={s.meta}>{note}</p>}
        </div>
        <ScoreMark score={score.overall} />
      </section>

      <ul className={s.categories} aria-label="Scores by category">
        {score.categories.map((c) => (
          <li key={c.id} data-band={band(c.score).id}>
            <span className={s.catName}>{c.name}</span>
            <span className={s.catScore}>{c.score}</span>
          </li>
        ))}
      </ul>

      <div className={s.actions}>
        {score.tells.length > 0 && (
          <button type="button" className="btn" onClick={copyPrompt}>
            {copied ? "Copied" : "Copy fix prompt for Claude Code"}
          </button>
        )}
        {payloads && share.state !== "done" && (
          <button type="button" className="btn btnLine" onClick={makeLink} disabled={share.state === "saving"}>
            {share.state === "saving" ? "Saving" : "Create share link"}
          </button>
        )}
        {share.state === "done" && share.url && (
          <Link className="btn btnLine" href={share.url}>
            {payloads ? "Link copied" : "Permanent link"}
          </Link>
        )}
        <button type="button" className="btn btnLine" onClick={download}>
          Download JSON
        </button>
        {onRestart ? (
          <button type="button" className="btn btnLine" onClick={onRestart}>
            Audit another site
          </button>
        ) : (
          <Link className="btn btnLine" href="/">
            Audit your site
          </Link>
        )}
      </div>
      {share.state === "error" && (
        <p className={s.shareError} role="alert">
          {share.error}
        </p>
      )}

      {score.tells.length > 0 && (
        <details className={s.prompt}>
          <summary>What the prompt says</summary>
          <pre>{prompt}</pre>
        </details>
      )}

      {fixes.length > 0 && (
        <section className={s.group} aria-labelledby="fix-title">
          <h2 id="fix-title" className={s.groupTitle}>
            To fix
          </h2>
          <p className={s.groupLede}>These read as generated on almost any site. Remove them unless the keep rule applies.</p>
          {fixes.map((t) => (
            <TellBlock key={t.tell.id} t={t} pages={view.pages} crops={cropsFor(t.tell.id)} total={view.pages.length} />
          ))}
        </section>
      )}

      {reviews.length > 0 && (
        <section className={s.group} aria-labelledby="review-title">
          <h2 id="review-title" className={s.groupTitle}>
            To review
          </h2>
          <p className={s.groupLede}>
            These are right on some sites and wrong on most. Honesty items stay only when the business can show a source.
          </p>
          {reviews.map((t) => (
            <TellBlock key={t.tell.id} t={t} pages={view.pages} crops={cropsFor(t.tell.id)} total={view.pages.length} />
          ))}
        </section>
      )}

      <section className={s.group} aria-labelledby="pages-title">
        <h2 id="pages-title" className={s.groupTitle}>
          Pages
        </h2>
        <table className={s.pages}>
          <thead>
            <tr>
              <th scope="col">Page</th>
              <th scope="col">Score</th>
              <th scope="col">Main tells</th>
            </tr>
          </thead>
          <tbody>
            {score.pageScores.map((p) => {
              const page = view.pages.find((x) => x.url === p.url) as PageResult;
              const top = score.tells.filter((t) => t.pages.includes(p.url)).slice(0, 3);
              return (
                <tr key={p.url}>
                  <td>
                    <a href={p.url} rel="nofollow noopener" target="_blank">
                      {pathOf(p.url)}
                    </a>
                    {page?.title && <span className={s.pageTitle}>{page.title}</span>}
                  </td>
                  <td data-band={band(p.score).id} className={s.pageScore}>
                    {p.score}
                  </td>
                  <td>{top.length ? top.map((t) => t.tell.name).join(", ") : "None"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {fonts.length > 0 && (
        <section className={s.group} aria-labelledby="fonts-title">
          <h2 id="fonts-title" className={s.groupTitle}>
            Typefaces
          </h2>
          <ul className={s.fonts}>
            {fonts.map(([family, share]) => (
              <li key={family}>
                <span>{family}</span>
                <span className={s.fontShare}>{Math.round(share * 100)}% of the text</span>
                {AI_FONT.test(family) && <span className={s.fontFlag}>a default AI typeface</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className={s.method}>
        The score weighs each tell by how strongly it reads as generated and how much of the site it covers.{" "}
        <Link href="/method">How scoring works</Link>. A rendered audit sees what a visitor sees, so it can miss tells inside
        images and canvas, and it can flag a choice that is right for this brand. The keep rules are there for that.
      </p>
    </main>
  );
}
