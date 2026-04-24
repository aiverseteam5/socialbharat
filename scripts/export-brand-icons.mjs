/**
 * Render the website's actual SB icon and SocialBharat wordmark into
 * platform submission PNGs using outlined Inter glyphs (text-to-svg).
 * Outlining glyphs to `<path>` elements avoids librsvg's unreliable font
 * matching, so output is pixel-identical regardless of system fonts.
 *
 * Usage: node scripts/export-brand-icons.mjs
 *
 * Outputs:
 *   public/brand/icon-1024.png      — Meta App icon (1024x1024, white bg)
 *   public/brand/icon-200.png       — Razorpay KYC (200x200)
 *   public/brand/icon-120.png       — Google OAuth consent (120x120)
 *   public/brand/wordmark-1024.png  — Horizontal wordmark on white (1024x256)
 *   public/brand/wordmark.svg       — Portable wordmark SVG (paths, no fonts)
 */
import sharp from "../node_modules/.pnpm/sharp@0.34.5/node_modules/sharp/lib/index.js";
import TextToSVG from "../node_modules/.pnpm/text-to-svg@3.1.5/node_modules/text-to-svg/index.js";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

if (!existsSync("tmp-fonts/Inter-Bold.ttf")) {
  console.error(
    "Missing tmp-fonts/Inter-Bold.ttf. Setup:\n" +
      "  curl -sL -o /tmp/Inter.zip https://github.com/rsms/inter/releases/download/v4.0/Inter-4.0.zip\n" +
      "  unzip -j -o /tmp/Inter.zip 'extras/ttf/Inter-Bold.ttf' 'extras/ttf/Inter-Black.ttf' -d tmp-fonts/",
  );
  process.exit(1);
}

const ORANGE = "#FF6B35";
const DARK = "#0F172A";
const PAD_PCT = 0.1;

const tInterBlack = TextToSVG.loadSync("tmp-fonts/Inter-Black.ttf");
const tInterBold = TextToSVG.loadSync("tmp-fonts/Inter-Bold.ttf");

function getPath(t2s, text, fontSize, x, y, color) {
  return t2s.getPath(text, {
    x,
    y,
    fontSize,
    anchor: "left top",
    attributes: { fill: color },
  });
}

function getMetrics(t2s, text, fontSize) {
  return t2s.getMetrics(text, { fontSize, anchor: "left top" });
}

function iconSVG(size) {
  const inner = Math.round(size * (1 - PAD_PCT * 2));
  const offset = Math.round((size - inner) / 2);
  const radius = Math.round(inner * 0.22);
  const fontSize = Math.round(inner * 0.5);
  const m = getMetrics(tInterBlack, "SB", fontSize);
  const textX = (size - m.width) / 2;
  const textY = (size - m.height) / 2;
  const sbPath = getPath(tInterBlack, "SB", fontSize, textX, textY, "#ffffff");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#ffffff"/>
  <rect x="${offset}" y="${offset}" width="${inner}" height="${inner}" rx="${radius}" ry="${radius}" fill="${ORANGE}"/>
  ${sbPath}
</svg>`;
}

function wordmarkSVG(width, height, { whiteBg = true } = {}) {
  const tileSize = Math.round(height * 0.62);
  const tileRadius = Math.round(tileSize * 0.22);
  const tileFontSize = Math.round(tileSize * 0.5);
  const wordFontSize = Math.round(height * 0.46);
  const tileX = Math.round(height * 0.2);
  const tileY = Math.round((height - tileSize) / 2);
  const wordX = tileX + tileSize + Math.round(height * 0.18);

  // SB inside tile
  const tileMetrics = getMetrics(tInterBlack, "SB", tileFontSize);
  const sbX = tileX + (tileSize - tileMetrics.width) / 2;
  const sbY = tileY + (tileSize - tileMetrics.height) / 2;
  const sbPath = getPath(tInterBlack, "SB", tileFontSize, sbX, sbY, "#ffffff");

  // Social + Bharat
  const socialMetrics = getMetrics(tInterBold, "Social", wordFontSize);
  const wordY = (height - socialMetrics.height) / 2;
  const socialPath = getPath(tInterBold, "Social", wordFontSize, wordX, wordY, DARK);
  const bharatX = wordX + socialMetrics.width;
  const bharatPath = getPath(tInterBold, "Bharat", wordFontSize, bharatX, wordY, ORANGE);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  ${whiteBg ? `<rect width="${width}" height="${height}" fill="#ffffff"/>` : ""}
  <rect x="${tileX}" y="${tileY}" width="${tileSize}" height="${tileSize}" rx="${tileRadius}" ry="${tileRadius}" fill="${ORANGE}"/>
  ${sbPath}
  ${socialPath}
  ${bharatPath}
</svg>`;
}

mkdirSync("public/brand", { recursive: true });

const iconTargets = [
  { size: 1024, out: "public/brand/icon-1024.png" },
  { size: 200, out: "public/brand/icon-200.png" },
  { size: 120, out: "public/brand/icon-120.png" },
];

for (const { size, out } of iconTargets) {
  await sharp(Buffer.from(iconSVG(size))).png().toFile(out);
  console.log(`Wrote ${out} (${size}x${size})`);
}

await sharp(Buffer.from(wordmarkSVG(1024, 256))).png().toFile("public/brand/wordmark-1024.png");
console.log("Wrote public/brand/wordmark-1024.png (1024x256)");

writeFileSync("public/brand/wordmark.svg", wordmarkSVG(400, 80, { whiteBg: false }));
console.log("Wrote public/brand/wordmark.svg (400x80, paths)");
