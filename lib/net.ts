import { lookup } from "node:dns/promises";
import net from "node:net";

export const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 DeslopBot/0.1 (+https://deslop.elmir.dev/method)";

export class AuditError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const allowPrivate = () => process.env.NODE_ENV !== "production" || process.env.ALLOW_PRIVATE_HOSTS === "1";

function isPrivateIp(ip: string) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 10 || a === 127 || a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    );
  }
  const v = ip.toLowerCase();
  if (v.startsWith("::ffff:")) return isPrivateIp(v.slice(7));
  return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb");
}

const hostCache = new Map<string, boolean>();

/** Rejects anything but public http(s) hosts, so the auditor cannot be pointed at internal services. */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new AuditError("That does not look like a web address.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new AuditError("Only http and https addresses can be audited.");
  if (url.username || url.password) throw new AuditError("Addresses with a username or password cannot be audited.");
  if (allowPrivate()) return url;

  const host = url.hostname.replace(/^\[|\]$/g, "");
  const cached = hostCache.get(host);
  if (cached === false) throw new AuditError("That address points to a private network.");
  if (cached) return url;
  if (/^(localhost|.*\.local|.*\.internal|.*\.localhost)$/i.test(host)) throw new AuditError("That address points to a private network.");
  let addrs: { address: string }[];
  try {
    addrs = net.isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  } catch {
    throw new AuditError("That domain could not be found.");
  }
  const ok = addrs.length > 0 && addrs.every((a) => !isPrivateIp(a.address));
  hostCache.set(host, ok);
  if (!ok) throw new AuditError("That address points to a private network.");
  return url;
}

/** Normalizes what people type: adds https://, trims spaces. */
export function normalizeInput(input: string) {
  const v = input.trim();
  if (!v) return v;
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : "https://" + v;
}

export async function fetchText(url: string, timeoutMs = 10000): Promise<{ text: string; finalUrl: string; ok: boolean; type: string }> {
  await assertPublicUrl(url);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { redirect: "follow", signal: ctrl.signal, headers: { "user-agent": USER_AGENT, accept: "text/html,application/xml;q=0.9,*/*;q=0.8" } });
    await assertPublicUrl(res.url || url);
    const type = res.headers.get("content-type") || "";
    const text = res.ok ? (await res.text()).slice(0, 2_000_000) : "";
    return { text, finalUrl: res.url || url, ok: res.ok, type };
  } finally {
    clearTimeout(timer);
  }
}
