// Brand tokens shared by the PWA icon generator (scripts/brand/gen-icons.ts)
// and the Open Graph image route (src/app/opengraph-image.tsx). Neither of
// those can read globals.css or the Tailwind config — ImageResponse rasterises
// outside the browser — so the palette is mirrored here once instead of being
// retyped as literals in two places that would then drift apart.
//
// Values match the Atelier light palette in src/app/globals.css:
//   --paper 253 251 246  ·  --ink 31 28 22  ·  --ember 200 130 26
export const BRAND = {
  name: "Atelier",
  ink: "#1F1C16",
  paper: "#FDFBF6",
  ember: "#C8821A",
  // The mark always sits on ink, where the light-mode ember reads muddy. This
  // is the dark-mode ember from globals.css (232 165 71).
  emberOnInk: "#E2942A",
  soft: "#7A7361",
  line: "rgba(31, 28, 22, 0.14)",
} as const;

// The mark, in a 64-unit artboard. A single-storey lowercase "a": the bowl is
// a ring and the stem a rounded bar fused to its right side. Kept as numbers
// rather than an SVG string so both the raster generator and any future inline
// use derive from one definition. Mirrors public/favicon.svg.
//
// The stem spans exactly the bowl's height (y 16→48) and no further. Give it
// an ascender and the letterform stops being an "a" and becomes a "d".
export const MARK = {
  artboard: 64,
  cornerRadius: 14,
  bowl: { cx: 29.5, cy: 32, outerRadius: 16, stroke: 9 },
  stem: { x: 41.5, y: 16, width: 9, height: 32, radius: 4.5 },
} as const;
