import { AuditError, assertPublicUrl, fetchText } from "./net";

const SKIP_PATH = /\/(?:login|log-in|signin|sign-in|signup|sign-up|register|cart|checkout|account|admin|wp-admin|wp-login|feed|rss|tag|tags|category|categories|author|search|page\/\d+|cdn-cgi)(?:\/|$)/i;
const ASSET = /\.(?:pdf|jpe?g|png|gif|webp|avif|svg|ico|zip|gz|mp4|webm|mp3|wav|xml|json|txt|css|js|woff2?|ttf|docx?|xlsx?|pptx?)$/i;

type Robots = { disallow: string[]; allow: string[]; sitemaps: string[] };

function parseRobots(text: string): Robots {
  const out: Robots = { disallow: [], allow: [], sitemaps: [] };
  let applies = false;
  let sawAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === "sitemap") out.sitemaps.push(val);
    else if (key === "user-agent") {
      if (!sawAgent) applies = false;
      sawAgent = true;
      if (val === "*" || /deslop/i.test(val)) applies = true;
    } else {
      sawAgent = false;
      if (!applies) continue;
      if (key === "disallow" && val) out.disallow.push(val);
      if (key === "allow" && val) out.allow.push(val);
    }
  }
  return out;
}

function robotsAllows(r: Robots, path: string) {
  const match = (rule: string) => {
    const rx = new RegExp("^" + rule.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$"));
    return rx.test(path);
  };
  const dis = r.disallow.filter(match).sort((a, b) => b.length - a.length)[0];
  const al = r.allow.filter(match).sort((a, b) => b.length - a.length)[0];
  if (!dis) return true;
  return Boolean(al && al.length >= dis.length);
}

function cleanUrl(href: string, base: URL): URL | null {
  try {
    const u = new URL(href, base);
    if (u.origin !== base.origin) return null;
    u.hash = "";
    u.search = "";
    if (ASSET.test(u.pathname) || SKIP_PATH.test(u.pathname)) return null;
    return u;
  } catch {
    return null;
  }
}

export type Discovery = { site: string; origin: string; pages: string[]; skipped: number; note: string | null };

/** Finds the pages worth auditing: the home page, then sitemap and navigation links, a few per section. */
export async function discover(input: string, maxPages: number): Promise<Discovery> {
  const start = await assertPublicUrl(input);
  let home;
  try {
    home = await fetchText(start.toString());
  } catch (e) {
    if (e instanceof AuditError) throw e;
    throw new AuditError("The site did not respond within 10 seconds.");
  }
  if (!home.ok) throw new AuditError("The site answered with an error page. Check the address and try again.");
  const base = new URL(home.finalUrl);

  let robots: Robots = { disallow: [], allow: [], sitemaps: [] };
  try {
    const r = await fetchText(base.origin + "/robots.txt", 5000);
    if (r.ok && !/html/i.test(r.type)) robots = parseRobots(r.text);
  } catch {
    /* no robots.txt is fine */
  }
  if (!robotsAllows(robots, base.pathname)) throw new AuditError("This site's robots.txt asks crawlers not to visit this page, so it was not audited.");

  const found: URL[] = [base];
  const add = (u: URL | null) => {
    if (u && !found.some((f) => f.pathname.replace(/\/$/, "") === u.pathname.replace(/\/$/, ""))) found.push(u);
  };

  // links in the page, in reading order; navigation links come first in most markup
  for (const m of home.text.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"'#][^"']*)["']/gi)) add(cleanUrl(m[1].replace(/&amp;/g, "&"), base));

  const sitemapUrls = robots.sitemaps.length ? robots.sitemaps.slice(0, 2) : [base.origin + "/sitemap.xml"];
  for (const sm of sitemapUrls) {
    try {
      const r = await fetchText(sm, 6000);
      if (!r.ok) continue;
      const locs = Array.from(r.text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)).map((m) => m[1]);
      // a sitemap index lists more sitemaps; read the first one
      if (/<sitemapindex/i.test(r.text) && locs[0]) {
        const inner = await fetchText(locs[0], 6000).catch(() => null);
        if (inner?.ok) for (const m of inner.text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) add(cleanUrl(m[1], base));
      } else {
        for (const l of locs.slice(0, 300)) add(cleanUrl(l, base));
      }
    } catch {
      /* sitemap is optional */
    }
  }

  // breadth before depth, and at most three pages from any one section (blog, products)
  const allowed = found.filter((u) => robotsAllows(robots, u.pathname));
  const skipped = found.length - allowed.length;
  const [first, ...rest] = allowed;
  const depth = (u: URL) => u.pathname.split("/").filter(Boolean).length;
  rest.sort((a, b) => depth(a) - depth(b));
  const perSection: Record<string, number> = {};
  const picked = [first];
  for (const u of rest) {
    if (picked.length >= maxPages) break;
    const section = u.pathname.split("/").filter(Boolean)[0] || "";
    perSection[section] = (perSection[section] || 0) + 1;
    if (depth(u) > 1 && perSection[section] > 3) continue;
    picked.push(u);
  }

  return {
    site: base.host,
    origin: base.origin,
    pages: picked.map((u) => u.toString()),
    skipped,
    note: skipped ? `${skipped} pages were left out because robots.txt asks crawlers to skip them.` : null,
  };
}
