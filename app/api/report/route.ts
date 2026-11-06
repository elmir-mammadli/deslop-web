import { clientIp, errorResponse, rateLimit } from "@/lib/guard";
import { AuditError } from "@/lib/net";
import { verifyResult } from "@/lib/sign";
import { canSave, newId, saveReport } from "@/lib/store";
import type { Crop, PageResult, SavedReport } from "@/lib/types";

export const runtime = "nodejs";

type Body = { site?: string; pages?: { result: PageResult; sig: string }[]; crops?: Crop[]; thumbs?: Record<string, string> };

export async function POST(req: Request) {
  try {
    if (!canSave()) throw new AuditError("Saving reports is not set up on this server.", 501);
    rateLimit("save:" + clientIp(req), 10, 15 * 60 * 1000);
    const raw = await req.text();
    if (raw.length > 4_000_000) throw new AuditError("This report is too large to save.", 413);
    const body = JSON.parse(raw) as Body;
    if (!body.site || !Array.isArray(body.pages) || !body.pages.length || body.pages.length > 20) throw new AuditError("This report is incomplete.");
    for (const p of body.pages) {
      if (!verifyResult(p.result, p.sig)) throw new AuditError("This report could not be verified. Run the audit again.", 422);
    }
    const crops = (body.crops || []).filter((c) => typeof c.src === "string" && c.src.startsWith("data:image/jpeg;base64,")).slice(0, 60);
    const thumbs = Object.fromEntries(Object.entries(body.thumbs || {}).filter(([, v]) => typeof v === "string" && v.startsWith("data:image/jpeg;base64,")).slice(0, 20));
    const report: SavedReport = { id: newId(), site: String(body.site).slice(0, 200), createdAt: new Date().toISOString(), pages: body.pages.map((p) => p.result), crops, thumbs };
    await saveReport(report);
    return Response.json({ id: report.id });
  } catch (e) {
    return errorResponse(e);
  }
}
