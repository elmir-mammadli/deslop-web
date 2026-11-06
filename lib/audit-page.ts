import type { Page } from "puppeteer-core";
import { getBrowser, serverless } from "./browser";
import { inpageAudit } from "./inpage";
import { AuditError, USER_AGENT, assertPublicUrl } from "./net";
import { signResult } from "./sign";
import { TELL_BY_ID } from "./tells";
import type { Crop, Finding, PagePayload, PageResult } from "./types";

const WIDTH = 1440;
const HEIGHT = 900;
const CROPS_PER_TELL = 2;
const MAX_CROPS = 24;
const CROP_MAX_W = 960;
const CROP_MAX_H = 520;

async function settle(page: Page) {
  // walk the page so lazy images load and scroll-triggered sections reveal, then return to the top
  await page.evaluate(async () => {
    const step = Math.max(400, innerHeight * 0.8);
    const limit = Math.min(document.documentElement.scrollHeight, 16000);
    for (let y = 0; y < limit; y += step) {
      scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 90));
    }
    scrollTo(0, document.documentElement.scrollHeight);
    await new Promise((r) => setTimeout(r, 250));
    scrollTo(0, 0);
  });
  await new Promise((r) => setTimeout(r, 900));
}

async function crop(page: Page, f: Finding, docH: number): Promise<Crop | null> {
  if (!f.rect || f.rect.w < 2 || f.rect.h < 2) return null;
  const pad = 28;
  const x = Math.max(0, f.rect.x - pad);
  const y = Math.max(0, f.rect.y - pad);
  const w = Math.min(WIDTH - x, f.rect.w + pad * 2, 1200);
  const h = Math.min(docH - y, f.rect.h + pad * 2, 700);
  if (w < 8 || h < 8) return null;
  const scale = Math.min(1, CROP_MAX_W / w, CROP_MAX_H / h);
  try {
    const buf = await page.screenshot({ type: "jpeg", quality: 62, clip: { x, y, width: w, height: h, scale }, captureBeyondViewport: true });
    return {
      tell: f.tell,
      src: "data:image/jpeg;base64," + Buffer.from(buf).toString("base64"),
      width: Math.round(w * scale),
      height: Math.round(h * scale),
      box: {
        x: Math.round((f.rect.x - x) * scale),
        y: Math.round((f.rect.y - y) * scale),
        w: Math.round(Math.min(f.rect.w, w) * scale),
        h: Math.round(Math.min(f.rect.h, h) * scale),
      },
      text: f.text,
      path: f.path,
    };
  } catch {
    return null;
  }
}

export async function auditPage(url: string): Promise<PagePayload> {
  await assertPublicUrl(url);
  const browser = await getBrowser();
  const context = serverless ? null : await browser.createBrowserContext();
  const page = context ? await context.newPage() : await browser.newPage();
  try {
    await page.setUserAgent(USER_AGENT);
    await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const type = req.resourceType();
      if (type === "media" || type === "websocket" || type === "eventsource") return req.abort().catch(() => {});
      if (req.isNavigationRequest() && req.frame() === page.mainFrame()) {
        assertPublicUrl(req.url())
          .then(() => req.continue())
          .catch(() => req.abort("blockedbyclient"));
        return;
      }
      req.continue().catch(() => {});
    });

    let res;
    try {
      res = await page.goto(url, { waitUntil: "networkidle2", timeout: 25000 });
    } catch {
      // busy pages never go idle; audit what has rendered
      res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => null);
      if (!res) throw new AuditError("The page did not load within 40 seconds.", 504);
    }
    if (res && res.status() >= 400) throw new AuditError(`The page answered with status ${res.status()}.`, 502);

    await settle(page);
    const data = await page.evaluate(inpageAudit);
    const docH = await page.evaluate(() => document.documentElement.scrollHeight);

    // examples to show: fix-level tells first, a couple per tell
    const ordered = [...data.findings].sort((a, b) => {
      const la = TELL_BY_ID[a.tell]?.level === "fix" ? 0 : 1;
      const lb = TELL_BY_ID[b.tell]?.level === "fix" ? 0 : 1;
      return la - lb || (TELL_BY_ID[b.tell]?.weight ?? 0) - (TELL_BY_ID[a.tell]?.weight ?? 0);
    });
    const perTell: Record<string, number> = {};
    const crops: Crop[] = [];
    const shot = new Set<string>();
    for (const f of ordered) {
      if (crops.length >= MAX_CROPS) break;
      if ((perTell[f.tell] || 0) >= CROPS_PER_TELL) continue;
      const spot = f.tell + (f.rect ? `${f.rect.x},${f.rect.y},${f.rect.w}` : "");
      if (shot.has(spot)) continue;
      shot.add(spot);
      const c = await crop(page, f, docH);
      if (c) {
        crops.push(c);
        perTell[f.tell] = (perTell[f.tell] || 0) + 1;
      }
    }

    const thumbBuf = await page
      .screenshot({ type: "jpeg", quality: 60, clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT, scale: 0.4 } })
      .catch(() => null);

    const result: PageResult = {
      url: page.url(),
      title: data.title,
      counts: data.counts,
      findings: data.findings,
      fonts: data.fonts,
      stats: data.stats,
      auditedAt: new Date().toISOString(),
    };
    return {
      result,
      sig: signResult(result),
      crops,
      thumb: thumbBuf ? "data:image/jpeg;base64," + Buffer.from(thumbBuf).toString("base64") : null,
    };
  } finally {
    if (context) await context.close().catch(() => {});
    else await page.close().catch(() => {});
  }
}
