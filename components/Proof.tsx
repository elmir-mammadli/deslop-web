import s from "./proof.module.css";

// Scores come from running this site's own audit on public/sample/before.html and after.html.
// Re-run both through /api/audit and lib/score.ts whenever either sample or the scoring changes.
const BEFORE_SCORE = 10;
const AFTER_SCORE = 100;

function Ring({ score, tone }: { score: number; tone: "bad" | "good" }) {
  return (
    <div className={s.ring} data-tone={tone}>
      <svg viewBox="0 0 220 150" aria-hidden="true">
        <path d="M36 82 C 28 36, 160 14, 192 58 C 216 92, 170 136, 104 136 C 44 136, 14 104, 34 64 C 46 42, 82 28, 118 26" />
      </svg>
      <span className={s.ringNumber}>{score}</span>
      <span className="visuallyHidden"> out of 100</span>
    </div>
  );
}

export default function Proof() {
  return (
    <figure className={`wrap ${s.figure}`} aria-labelledby="proof-caption">
      <div className={s.sheet}>
        <div className={s.row}>
          <div>
            <p className={s.tag}>Before</p>
            <div className={s.slop} aria-hidden="true">
              <p className={s.slopStatus}>
                <span className={s.strike}>● Accepting clients</span>
              </p>
              <p className={s.slopEyebrow}>
                <span className={s.strike}>{"// 01 / Studio"}</span>
              </p>
              <p className={s.slopTitle}>
                Design that <span className={`${s.accent} ${s.circle}`}>moves</span> people<span className={s.circle}>.</span>
              </p>
              <p className={s.slopBody}>
                <span className={s.strike}>We craft digital experiences. We build brands. We ship products that matter.</span>
              </p>
              <span className={`${s.slopBtn} ${s.circle}`}>Start a Project</span>
              <p className={s.slopStats}>
                <span className={s.circle}>500+</span> happy clients
              </p>
            </div>
          </div>
          <div className={s.margin}>
            <Ring score={BEFORE_SCORE} tone="bad" />
            <ul className={s.notes}>
              <li>A pulsing dot with nothing behind it</li>
              <li>Eyebrow label: mono, capitals, a fake section number</li>
              <li>Gradient accent word and a period in the headline</li>
              <li>Three slogans where one fact would do</li>
              <li>Pill button in Title Case</li>
              <li>A number with no source</li>
            </ul>
          </div>
        </div>

        <div className={`${s.row} ${s.after}`}>
          <div>
            <p className={s.tag}>After</p>
            <p className={s.fixedTitle}>Websites for shops that already have a reputation</p>
            <p className={s.fixedBody}>
              We design sites for independent businesses that are busy through word of mouth and want the website to say what
              their customers already say about them.
            </p>
            <span className={s.fixedBtn} aria-hidden="true">
              Book a first call
            </span>
            <p className={s.fixedNote}>Two new projects a month. The next opening is in March.</p>
          </div>
          <div className={s.margin}>
            <Ring score={AFTER_SCORE} tone="good" />
            <ul className={s.notes}>
              <li className={s.noteGood}>The slogans became facts a customer can use</li>
            </ul>
          </div>
        </div>
      </div>
      <figcaption id="proof-caption" className={s.caption}>
        The same studio hero before and after a pass, scored by this audit. Open the{" "}
        <a href="/sample/before.html">before</a> and <a href="/sample/after.html">after</a> pages and run them yourself.
      </figcaption>
    </figure>
  );
}
