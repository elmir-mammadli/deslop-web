/** @type {import('next').NextConfig} */
const nextConfig = {
  // Chromium ships as a binary pack; keep both out of the bundle so Vercel traces them as files.
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  outputFileTracingIncludes: {
    "/api/audit": ["./node_modules/@sparticuz/chromium/bin/**"],
  },
  poweredByHeader: false,
};

export default nextConfig;
