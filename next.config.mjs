/** @type {import('next').NextConfig} */
const nextConfig = {
  // Chromium ships as a binary pack; keep both out of the bundle so Vercel traces them as files.
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  outputFileTracingIncludes: {
    // pnpm keeps packages behind symlinks; include the real folder so the deploy package has no symlinked directories
    "/api/audit": ["./node_modules/.pnpm/@sparticuz+chromium@*/node_modules/@sparticuz/chromium/bin/**"],
  },
  poweredByHeader: false,
};

export default nextConfig;
