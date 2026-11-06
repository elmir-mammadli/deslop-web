/*
 * Makes next/font/google tolerate font URLs without a file extension.
 *
 * Next 15.5.7 reads the extension of every font URL Google Fonts returns with
 * `/\.(woff|woff2|eot|ttf|otf)$/.exec(url)[1]`. Google sometimes serves files
 * from extensionless URLs (e.g. `fonts.gstatic.com/l/font?kit=...`), which
 * makes `exec` return null and crashes the build with
 * "TypeError: Cannot read properties of null (reading '1')" - intermittently,
 * on whichever font hits it first. Next requests Chrome-flavoured CSS, so
 * those files are woff2; fall back to that extension instead of crashing.
 *
 * Idempotent; runs before `next build`. Safe to delete once Next ships a fix.
 */
const fs = require("node:fs");

const file = require.resolve("next/dist/compiled/@next/font/dist/google/loader.js");
const src = fs.readFileSync(file, "utf8");
const broken = "/\\.(woff|woff2|eot|ttf|otf)$/.exec(googleFontFileUrl)[1]";
const fixed = "(/\\.(woff|woff2|eot|ttf|otf)$/.exec(googleFontFileUrl) || [null, 'woff2'])[1]";

if (src.includes(fixed)) {
  console.log("[patch-next-font] already patched");
} else if (src.includes(broken)) {
  fs.writeFileSync(file, src.replace(broken, fixed));
  console.log("[patch-next-font] patched", file);
} else {
  console.warn("[patch-next-font] pattern not found; Next may already handle this. Skipping.");
}
