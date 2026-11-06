import s from "./sketch.module.css";

type Status = "waiting" | "running" | "done" | "failed";

// A page drawn in pencil: blank while it waits, lines writing in while it is read,
// then marked in red where tells were found, ticked when it is clean, crossed when skipped.
export function PageSketch({ status, clean }: { status: Status; clean?: boolean }) {
  return (
    <svg className={s.page} data-status={status} viewBox="0 0 40 52" width="40" height="52" aria-hidden="true" focusable="false">
      <path className={s.sheet} d="M4 3 H28 L36 11 V49 H4 Z" />
      <path className={s.sheet} d="M28 3 V11 H36" />
      <g className={s.lines}>
        <path d="M9 18 H31" />
        <path d="M9 24 H27" />
        <path d="M9 30 H31" />
        <path d="M9 36 H22" />
        <path d="M9 42 H29" />
      </g>
      {status === "running" && <ellipse className={s.scribble} cx="18" cy="24" rx="12" ry="5" transform="rotate(-4 18 24)" />}
      {status === "done" && !clean && <ellipse className={s.mark} cx="18" cy="24" rx="12" ry="5" transform="rotate(-4 18 24)" />}
      {status === "done" && clean && <path className={s.tick} d="M24 40 L29 45 L38 33" />}
      {status === "failed" && <path className={s.mark} d="M10 16 L32 44 M32 16 L10 44" />}
    </svg>
  );
}

// The home page with its links fanning out to the pages it finds.
export function SiteSketch() {
  return (
    <svg className={s.site} viewBox="0 0 240 120" width="240" height="120" aria-hidden="true" focusable="false">
      <path className={s.sheet} d="M100 8 H132 L140 16 V52 H100 Z" />
      <path className={s.homeLines} d="M106 24 H134 M106 31 H128 M106 38 H134" />
      {[22, 76, 130, 184].map((x, i) => (
        <g key={x} className={s.branch} style={{ animationDelay: `${i * 0.35}s` }}>
          <path d={`M120 52 C 120 70, ${x + 16} 66, ${x + 16} 82`} />
          <path d={`M${x} 82 H${x + 26} L${x + 32} 88 V114 H${x} Z`} />
        </g>
      ))}
    </svg>
  );
}

// Pencil rule that lengthens as pages finish.
export function ProgressRule({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className={s.rule} role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label="Pages audited">
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}
