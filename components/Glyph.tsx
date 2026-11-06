// Small pencil drawings of one tell per group: ink for the tell, red for the editor's mark.

const INK = { stroke: "var(--ink)", strokeWidth: 1.5, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" } as const;
const RED = { stroke: "var(--pencil)", strokeWidth: 2, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" } as const;

const STAR = "M0,-7 L2,-2.4 7,-2.2 3.2,1 4.4,6 0,3.2 -4.4,6 -3.2,1 -7,-2.2 -2,-2.4 Z";

const DRAWINGS: Record<string, React.ReactNode> = {
  // a tiny tracked-out capital label over a heading
  typography: (
    <>
      {[8, 16, 24, 32, 40].map((x) => (
        <path key={x} {...INK} strokeWidth={1.25} d={`M${x} 12 v6`} />
      ))}
      <path {...INK} strokeWidth={4} d="M8 32 H64" />
      <path {...INK} strokeWidth={4} d="M8 42 H46" />
      <path {...RED} d="M4 21 C 18 24, 34 18, 48 22" />
    </>
  ),
  // a soft card with its corner radius measured
  shape: (
    <>
      <rect {...INK} x="10" y="10" width="52" height="34" rx="12" />
      <path {...RED} d="M10 22 A12 12 0 0 1 22 10" strokeWidth={2.5} />
      <path {...RED} strokeWidth={1.25} d="M22 22 L14 14" />
      <path {...RED} strokeWidth={1.25} d="M22 22 h-3 M22 22 v-3" />
    </>
  ),
  // a wash drawn as hatching that fades out, crossed through
  color: (
    <>
      <rect {...INK} x="10" y="10" width="52" height="34" rx="2" />
      {[16, 22, 28, 34, 41, 49].map((x, i) => (
        <path key={x} {...INK} strokeWidth={1} opacity={1 - i * 0.15} d={`M${x} 44 L${x + 10} 10`} />
      ))}
      <path {...RED} d="M8 48 L64 6" />
    </>
  ),
  // the same three cards again, bracketed
  structure: (
    <>
      {[8, 28, 48].map((x) => (
        <rect key={x} {...INK} x={x} y="18" width="16" height="22" rx="2" />
      ))}
      {[8, 28, 48].map((x) => (
        <path key={x} {...INK} strokeWidth={1} d={`M${x + 3} 23 h6`} />
      ))}
      <path {...RED} d="M8 12 C 8 8, 64 8, 64 12" />
      <path {...RED} d="M36 8 v-4" />
    </>
  ),
  // lines of text with one stock word struck out
  copy: (
    <>
      <path {...INK} d="M8 16 H64" />
      <path {...INK} d="M8 26 H22 M44 26 H64" />
      <path {...INK} d="M8 36 H52" />
      <rect {...RED} strokeWidth={1.5} x="24" y="21" width="18" height="10" rx="1" />
      <path {...RED} d="M22 31 L44 21" />
      <path {...INK} d="M8 46 H38" />
    </>
  ),
  // five stars with no source
  honesty: (
    <>
      {[10, 23, 36, 49].map((x) => (
        <path key={x} {...INK} strokeWidth={1.25} transform={`translate(${x} 28)`} d={STAR} />
      ))}
      <circle {...RED} cx="62" cy="16" r="8" />
      <path {...RED} strokeWidth={1.75} d="M59 13.5 C 59 10, 65 10, 65 13.5 C 65 16, 62 16, 62 18.5" />
      <path {...RED} strokeWidth={2.5} d="M62 21.6 v0.1" />
    </>
  ),
};

export default function Glyph({ group }: { group: string }) {
  return (
    <svg viewBox="0 0 72 52" width="72" height="52" aria-hidden="true" focusable="false">
      {DRAWINGS[group]}
    </svg>
  );
}
