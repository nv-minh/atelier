/* eslint-disable */
// Regenerates every raster brand asset from one vector definition.
//
// Run with:  npm run brand:icons
//
// The four PNGs under public/icons are referenced by src/app/manifest.ts and
// by public/sw.js (push notification icon + badge), so they cannot be Next
// metadata routes — a push handler needs a real file at a stable path. They
// are committed build artifacts, and this script is how they are rebuilt.
//
// Rasterising goes through next/og (satori + resvg), which ships with Next 14.
// That is deliberate: adding sharp or librsvg for four PNGs regenerated maybe
// twice a year is not worth a native dependency in CI.
//
// The geometry lives in src/lib/brand.ts and mirrors public/favicon.svg. Edit
// the mark there, run this, commit the PNGs.
import { ImageResponse } from "next/og";
import { createElement as h } from "react";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BRAND, MARK } from "../../src/lib/brand";

const OUT_DIR = join(process.cwd(), "public", "icons");

/**
 * The mark on its ink field.
 *
 * @param size   final pixel size of the square
 * @param inset  fraction of the square the artboard occupies. 1 fills it;
 *               maskable icons need the mark inside the central safe zone,
 *               because launchers crop the corners to whatever shape they like.
 * @param rounded  false for maskable and Apple, both of which apply their own
 *                 mask and would otherwise round already-rounded corners.
 */
function icon(size: number, inset: number, rounded: boolean) {
  const board = size * inset;
  const u = board / MARK.artboard; // one artboard unit, in pixels
  const pad = (size - board) / 2;

  const { bowl, stem } = MARK;
  const innerRadius = bowl.outerRadius - bowl.stroke;

  // The bowl is a ring, but satori will not render one: a div sized to the
  // counter with a thick border comes out as a solid disc. So the ring is
  // faked with two stacked circles — an ember disc, then an ink disc punching
  // the counter out of it. That only works because the field behind is the
  // same flat ink, which it always is here.
  //
  // Paint order matters: ember bowl, then the stem over its right edge so the
  // two fuse into one letterform, then the counter last so nothing fills it.
  const disc = (key: string, cx: number, cy: number, r: number, color: string) =>
    h("div", {
      key,
      style: {
        position: "absolute",
        left: pad + (cx - r) * u,
        top: pad + (cy - r) * u,
        width: r * 2 * u,
        height: r * 2 * u,
        borderRadius: r * 2 * u,
        background: color,
      },
    });

  return h(
    "div",
    {
      style: {
        display: "flex",
        position: "relative",
        width: size,
        height: size,
        background: BRAND.ink,
        borderRadius: rounded ? size * (MARK.cornerRadius / MARK.artboard) : 0,
      },
    },
    disc("bowl", bowl.cx, bowl.cy, bowl.outerRadius, BRAND.emberOnInk),
    h("div", {
      key: "stem",
      style: {
        position: "absolute",
        left: pad + stem.x * u,
        top: pad + stem.y * u,
        width: stem.width * u,
        height: stem.height * u,
        borderRadius: stem.radius * u,
        background: BRAND.emberOnInk,
      },
    }),
    disc("counter", bowl.cx, bowl.cy, innerRadius, BRAND.ink),
  );
}

const TARGETS = [
  // name, size, inset, rounded
  ["icon-192.png", 192, 1, true],
  ["icon-512.png", 512, 1, true],
  // Maskable: content must survive an aggressive crop, so the mark shrinks
  // into the central 80%-diameter safe zone and the ink bleeds to the edge.
  ["icon-maskable-512.png", 512, 0.72, false],
  // iOS masks the icon itself and dislikes transparency or pre-rounded corners.
  ["apple-touch-icon.png", 180, 1, false],
] as const;

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  for (const [name, size, inset, rounded] of TARGETS) {
    const res = new ImageResponse(icon(size, inset, rounded) as any, {
      width: size,
      height: size,
    });
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(join(OUT_DIR, name), buf);
    console.log(`${name.padEnd(24)} ${size}×${size}  ${(buf.length / 1024).toFixed(1)} KB`);
  }
  console.log(`\nWrote ${TARGETS.length} icons to public/icons/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
