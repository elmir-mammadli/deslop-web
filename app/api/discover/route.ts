import { discover } from "@/lib/crawl";
import { clientIp, errorResponse, rateLimit, verifyTurnstile } from "@/lib/guard";
import { AuditError, normalizeInput } from "@/lib/net";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { url, token } = (await req.json().catch(() => ({}))) as { url?: string; token?: string };
    if (!url) throw new AuditError("Enter the address of a website.");
    const ip = clientIp(req);
    await verifyTurnstile(token, ip);
    rateLimit("site:" + ip, 6, 15 * 60 * 1000);
    const max = Math.min(20, Math.max(1, Number(process.env.MAX_PAGES) || 12));
    return Response.json(await discover(normalizeInput(url), max));
  } catch (e) {
    return errorResponse(e);
  }
}
