import type { Metadata } from "next";
import { CATEGORIES, TELLS } from "@/lib/tells";
import s from "./method.module.css";

export const metadata: Metadata = {
  title: "How scoring works",
  description: "How Deslop audits a website, which tells it looks for, and how the score out of 100 is calculated.",
};

export default function Method() {
  return (
    <main className={`wrap ${s.page}`}>
      <h1 className={s.title}>How scoring works</h1>
      <div className={s.intro}>
        <p>
          Deslop finds up to 12 pages: the home page first, then links from the navigation and the sitemap, with no more
          than three pages from any one section. It skips pages that robots.txt asks crawlers to skip.
        </p>
        <p>
          Each page opens in Chrome at 1440 pixels wide. The browser scrolls to the end so lazy images and scroll effects
          render, returns to the top, and reads every visible element: its computed typeface, size, letter-spacing, case,
          corner radius, shadows and position, and the text inside it.
        </p>
      </div>

      <section className={s.section} aria-labelledby="score-title">
        <h2 id="score-title">From tells to a number</h2>
        <p>
          Every tell has a weight, set by how strongly it reads as generated, and a saturation point, the number of
          instances per page at which it counts as fully present. For each tell, severity is half coverage (the share of
          pages it appears on) and half intensity (instances against the saturation point). Its cost is weight times
          severity.
        </p>
        <p>
          The site score is 100 × e<sup>−cost / 10</sup>, summed over all tells, so one strong tell costs about a quarter
          of the score and a typical generated template lands near 30. Each category uses the same curve with a divisor of
          4. Scores of 90 and above have few generated tells, 50 to 89 have some, and below 50 have many.
        </p>
        <p>
          The weights are opinions, written down. They come from the{" "}
          <a href="https://github.com/elmir-mammadli/ai-deslop">ai-deslop</a> rules and have not yet been checked against
          human ratings of real sites. Read the score as a guide to the findings, not a verdict on the work.
        </p>
      </section>

      <section className={s.section} aria-labelledby="look-title">
        <h2 id="look-title">It measures the look, not the maker</h2>
        <p>
          Many of these tells started on large, carefully designed sites, then spread through templates and AI models
          trained on them. A famous site can score low, and a site written with AI help can score high after a careful pass.
          The score says how much of the common generated look a site carries, which is what a visitor reacts to.
        </p>
      </section>

      <section className={s.section} aria-labelledby="limits-title">
        <h2 id="limits-title">What it cannot see</h2>
        <p>
          Text inside images and canvas, pages behind a login, and anything that only appears after a click. It audits
          desktop width only. It cannot know intent: a condensed capital headline may be the brand, and a texture may be the
          art direction. That is what the keep rule under every finding is for.
        </p>
        <p>
          A page that shows tells on purpose, such as a style guide or this site&apos;s own before and after, can mark those
          blocks with a <code>data-deslop-keep</code> attribute. The audit skips them, and the report says how many it
          skipped. Pages that robots.txt disallows are not crawled.
        </p>
      </section>

      <section className={s.section} aria-labelledby="tells-title">
        <h2 id="tells-title">Every tell and its weight</h2>
        {CATEGORIES.map((c) => (
          <div key={c.id} className={s.cat}>
            <h3>{c.name}</h3>
            <table className={s.table}>
              <thead>
                <tr>
                  <th scope="col">Tell</th>
                  <th scope="col">Level</th>
                  <th scope="col">Weight</th>
                  <th scope="col">Full at</th>
                </tr>
              </thead>
              <tbody>
                {TELLS.filter((t) => t.category === c.id).map((t) => (
                  <tr key={t.id}>
                    <td>
                      {t.name}
                      <span className={s.why} data-deslop-keep="">{t.why}</span>
                    </td>
                    <td>{t.level === "fix" ? "Fix" : "Review"}</td>
                    <td>{t.weight}</td>
                    <td>
                      {t.saturation} per page
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </section>
    </main>
  );
}
