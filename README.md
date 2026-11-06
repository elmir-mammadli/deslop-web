# Deslop

A website that audits any site for the tells that make it look AI-generated. It opens the main pages in a real browser, reads the rendered result element by element, and returns a score out of 100, every finding marked on a screenshot, the fix for each, and a prompt for Claude Code.

Live at [deslop.elmir.dev](https://deslop.elmir.dev). The rules come from the [ai-deslop](https://github.com/elmir-mammadli/ai-deslop) skill.

## How it works

1. `POST /api/discover` reads the home page, robots.txt and the sitemap, and picks up to 12 pages, at most three per section.
2. `POST /api/audit` audits one page: Chrome at 1440 px, scrolled to the end, then `lib/inpage.ts` reads computed styles, layout and text. It returns findings, screenshot crops and a thumbnail. The result is signed with `DESLOP_SECRET`.
3. The browser runs two pages at a time and scores the site with `lib/score.ts`. The weights live in `lib/tells.ts` and are published on `/method`.
4. `POST /api/report` checks the signatures and saves the report to Vercel Blob, served at `/r/<id>`.

One page per function call keeps every request well inside Vercel's time limits.

## Develop

```bash
pnpm install
pnpm dev
```

Opens on http://localhost:3300. Local Chrome is found automatically; set `CHROME_PATH` if it is somewhere unusual. Local addresses can be audited in development only. Share links are saved to `.data/` locally.

## Deploy on Vercel

1. Import the repository in Vercel. The framework, install and build commands come from `vercel.json`.
2. Environment variables:
   - `DESLOP_SECRET`: a long random string (`openssl rand -hex 32`). Required in production.
   - `BLOB_READ_WRITE_TOKEN`: create a Blob store under Storage and connect it to the project; Vercel adds the token. Without it the share button is hidden.
   - Optional: `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` to put Cloudflare Turnstile on the form.
3. Add the domain `deslop.elmir.dev` under Settings → Domains, then add the record Vercel shows at your DNS host: a CNAME from `deslop` to `cname.vercel-dns.com`.

## Limits

- Desktop width only. Text in images and canvas, pages behind a login, and content that appears after a click are not seen.
- Rate limits are per server instance; Turnstile is the real gate against abuse.
- Private and local network addresses are refused in production.
