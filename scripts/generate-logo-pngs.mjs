/**
 * Rasterize public/logo-square.svg into platform-required PNG sizes.
 * Each PNG has a solid white background and ~10% padding around the icon.
 * Usage: node scripts/generate-logo-pngs.mjs
 */
import sharp from "../node_modules/.pnpm/sharp@0.34.5/node_modules/sharp/lib/index.js";
import { readFileSync } from "node:fs";

const svg = readFileSync("public/logo-square.svg");

const targets = [
  { size: 1024, out: "public/logo-1024.png" },
  { size: 200, out: "public/logo-200.png" },
  { size: 120, out: "public/logo-120.png" },
];

for (const { size, out } of targets) {
  const padding = Math.round(size * 0.1);
  const inner = size - padding * 2;
  await sharp(svg)
    .resize(inner, inner)
    .extend({
      top: padding,
      bottom: padding,
      left: padding,
      right: padding,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .flatten({ background: "#ffffff" })
    .png()
    .toFile(out);
  console.log(`Wrote ${out} (${size}x${size})`);
}
