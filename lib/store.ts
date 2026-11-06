import type { SavedReport } from "./types";

const hasBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
export const canSave = () => hasBlob() || process.env.NODE_ENV !== "production";

export function newId() {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export async function saveReport(report: SavedReport) {
  const body = JSON.stringify(report);
  if (hasBlob()) {
    const { put } = await import("@vercel/blob");
    await put(`reports/${report.id}.json`, body, { access: "public", contentType: "application/json", addRandomSuffix: false });
    return;
  }
  const fs = await import("node:fs/promises");
  await fs.mkdir(".data/reports", { recursive: true });
  await fs.writeFile(`.data/reports/${report.id}.json`, body);
}

export async function loadReport(id: string): Promise<SavedReport | null> {
  if (!/^[a-z0-9]{10}$/.test(id)) return null;
  if (hasBlob()) {
    const { head } = await import("@vercel/blob");
    try {
      const meta = await head(`reports/${id}.json`);
      const res = await fetch(meta.url);
      return res.ok ? ((await res.json()) as SavedReport) : null;
    } catch {
      return null;
    }
  }
  const fs = await import("node:fs/promises");
  try {
    return JSON.parse(await fs.readFile(`.data/reports/${id}.json`, "utf8")) as SavedReport;
  } catch {
    return null;
  }
}
