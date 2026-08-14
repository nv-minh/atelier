import { BRAND, MARK } from "@/lib/brand";

// The Atelier mark, inline. Same geometry as public/favicon.svg and the PNG
// icons under public/icons — all three read from MARK in src/lib/brand.ts, so
// the logo cannot drift between the tab, the home screen and the header.
//
// Inline rather than an <img src="/favicon.svg">: it costs no request, and it
// is drawn as vector geometry rather than a <text> element, so it does not
// depend on a serif font being installed on the reader's machine.
export function BrandMark({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const { bowl, stem, artboard, cornerRadius } = MARK;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${artboard} ${artboard}`}
      className={className}
      role="img"
      aria-label={BRAND.name}
    >
      <rect width={artboard} height={artboard} rx={cornerRadius} fill={BRAND.ink} />
      <circle
        cx={bowl.cx}
        cy={bowl.cy}
        r={bowl.outerRadius - bowl.stroke / 2}
        fill="none"
        stroke={BRAND.emberOnInk}
        strokeWidth={bowl.stroke}
      />
      <rect
        x={stem.x}
        y={stem.y}
        width={stem.width}
        height={stem.height}
        rx={stem.radius}
        fill={BRAND.emberOnInk}
      />
    </svg>
  );
}
