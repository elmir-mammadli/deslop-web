import { auditPage } from "@/lib/audit-page";
import { clientIp, errorResponse, rateLimit } from "@/lib/guard";
import { AuditError } from "@/lib/net";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { url } = (await req.json().catch(() => ({}))) as { url?: string };
    if (!url) throw new AuditError("Missing page address.");
    rateLimit("page:" + clientIp(req), 80, 15 * 60 * 1000);
    return Response.json(await auditPage(url));
  } catch (e) {
    return errorResponse(e);
  }
}
