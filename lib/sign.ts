import { createHmac, timingSafeEqual } from "node:crypto";
import type { PageResult } from "./types";

function secret() {
  const s = process.env.DESLOP_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("DESLOP_SECRET is not set");
  return "local-development-only";
}

export function signResult(result: PageResult) {
  return createHmac("sha256", secret()).update(JSON.stringify(result)).digest("hex");
}

export function verifyResult(result: PageResult, sig: string) {
  const expected = Buffer.from(signResult(result), "hex");
  const given = Buffer.from(sig || "", "hex");
  return expected.length === given.length && timingSafeEqual(expected, given);
}
