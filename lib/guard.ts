import { AuditError } from "./net";

// Per-instance limits. Serverless instances do not share memory, so this slows abuse down
// rather than stopping it; Turnstile on the form is the real gate when its keys are set.
const windows = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const hits = (windows.get(key) || []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    const wait = Math.ceil((windowMs - (now - hits[0])) / 60000);
    throw new AuditError(`Too many audits from this address. Try again in about ${wait} minute${wait === 1 ? "" : "s"}.`, 429);
  }
  hits.push(now);
  windows.set(key, hits);
  if (windows.size > 5000) windows.clear();
}

export function clientIp(req: Request) {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}

export async function verifyTurnstile(token: string | undefined, ip: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return;
  if (!token) throw new AuditError("Please complete the check before auditing.", 403);
  const body = new URLSearchParams({ secret, response: token, remoteip: ip });
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
  const data = (await res.json().catch(() => ({}))) as { success?: boolean };
  if (!data.success) throw new AuditError("The check did not pass. Reload the page and try again.", 403);
}

export function errorResponse(e: unknown) {
  if (e instanceof AuditError) return Response.json({ error: e.message }, { status: e.status });
  console.error(e);
  return Response.json({ error: "Something went wrong while auditing this page." }, { status: 500 });
}
