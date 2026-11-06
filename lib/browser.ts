import type { Browser } from "puppeteer-core";
import puppeteer from "puppeteer-core";

const LOCAL_CHROME = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];

let shared: Promise<Browser> | null = null;

/** Serverless Chromium is a single-process headless shell: it cannot hold separate browser contexts. */
export const serverless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

async function launch(): Promise<Browser> {
  if (serverless) {
    const chromium = (await import("@sparticuz/chromium")).default;
    chromium.setGraphicsMode = false; // no WebGL needed; skips unpacking SwiftShader on cold starts
    return puppeteer.launch({
      args: await puppeteer.defaultArgs({ args: [...chromium.args, "--hide-scrollbars"], headless: "shell" }),
      executablePath: await chromium.executablePath(),
      headless: "shell",
      defaultViewport: null,
      protocolTimeout: 45000,
    });
  }
  const fs = await import("node:fs");
  const executablePath = process.env.CHROME_PATH || LOCAL_CHROME.find((p) => fs.existsSync(p));
  if (!executablePath) throw new Error("No Chrome found. Set CHROME_PATH to a Chrome or Chromium binary.");
  return puppeteer.launch({
    executablePath,
    headless: true,
    defaultViewport: null,
    args: ["--hide-scrollbars", "--no-first-run", "--no-default-browser-check", "--disable-extensions", "--mute-audio"],
  });
}

/** One browser per server instance; each audit gets its own isolated context. */
export async function getBrowser(): Promise<Browser> {
  if (shared) {
    const b = await shared.catch(() => null);
    if (b && b.connected) return b;
  }
  shared = launch();
  const b = await shared;
  b.on("disconnected", () => {
    shared = null;
  });
  return b;
}
