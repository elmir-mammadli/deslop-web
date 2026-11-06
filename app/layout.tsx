import type { Metadata } from "next";
import { Newsreader } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import s from "./layout.module.css";

const serif = Newsreader({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-serif", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://deslop.elmir.dev"),
  title: { default: "Deslop: how generated does your website look?", template: "%s · Deslop" },
  description: "Audit any website for the tells that make it look AI-generated. A score out of 100, every tell marked on a screenshot, and the exact fix for each.",
  openGraph: { siteName: "Deslop", type: "website" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={serif.variable}>
      <body>
        <header className={`wrap ${s.top}`}>
          <Link className={s.mark} href="/">
            Deslop
          </Link>
          <nav aria-label="Main" className={s.nav}>
            <Link href="/method">How scoring works</Link>
            <a href="https://github.com/elmir-mammadli/ai-deslop">The skill</a>
          </nav>
        </header>
        {children}
        <footer className={s.footer}>
          <div className={`wrap ${s.footerRow}`}>
            <p>
              Made by <a href="https://elmir.dev">Elmir Mammadli</a>. The rules are open source in{" "}
              <a href="https://github.com/elmir-mammadli/ai-deslop">ai-deslop</a>.
            </p>
            <p>Audits read public pages only and respect robots.txt.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
