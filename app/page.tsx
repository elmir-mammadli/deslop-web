import Auditor from "@/components/Auditor";
import Glyph from "@/components/Glyph";
import Proof from "@/components/Proof";
import { canSave } from "@/lib/store";
import { CATEGORIES, TELLS } from "@/lib/tells";
import s from "./home.module.css";

const GROUPS: Record<string, string> = {
  typography: "Default AI typefaces, capitals on every label, tight headlines, italic flourishes, mono text that is not code.",
  shape: "Pill buttons and tags, and cards, images and sections rounded at 16px and more.",
  color: "Gradient washes and gradient text, glows, frosted glass, accent stripes, grain.",
  structure: "Eyebrow labels, 01 / 02 section numbers, code-style labels, periods after headlines, the same card row in every section.",
  // deslop-keep: names the stock words as examples
  copy: "Stock words like seamless and elevate, hype openers, staccato slogans, Title Case, emoji, exclamation marks.",
  honesty: "Numbers and proof that need a source, fake urgency, links to nowhere, placeholder text left in.",
};

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <Auditor canShare={canSave()}>
      <Proof />

      <section className={`wrap ${s.how}`} aria-labelledby="how-title">
        <h2 id="how-title" className={s.howTitle}>
          It reads the page a visitor sees
        </h2>
        <div className={s.howText}>
          <p>
            Most checks read source code. Deslop loads each page in Chrome, scrolls to the end so everything renders, and
            reads the computed style of every visible element: the typeface that actually loaded, the real corner radius
            of a button, the label that sits above a heading. Then it reads the text the way a visitor would.
          </p>
          <p>
            It looks for {TELLS.length} tells in six groups. Each one comes with a screenshot of where it appears, the fix,
            and the cases where it is the right call.
          </p>
        </div>
      </section>

      <section className={`wrap ${s.groups}`} aria-label="What it checks">
        <dl className={s.groupList}>
          {CATEGORIES.map((c) => (
            <div key={c.id} className={s.groupItem}>
              <dt>
                <Glyph group={c.id} />
                {c.name}
              </dt>
              <dd data-deslop-keep={c.id === "copy" || c.id === "honesty" ? "" : undefined}>{GROUPS[c.id]}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className={`wrap ${s.origin}`} aria-labelledby="origin-title">
        <h2 id="origin-title" className={s.howTitle}>
          Where the rules come from
        </h2>
        <p className={s.originText}>
          The tells come from <a href="https://github.com/elmir-mammadli/ai-deslop">ai-deslop</a>, a Claude skill built
          while removing them from 27 production websites. Every report ends with a prompt you can paste into Claude Code,
          so the same rules that found the problems can fix them in your codebase.
        </p>
      </section>
    </Auditor>
  );
}
