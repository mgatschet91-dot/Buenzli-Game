/**
 * Generates individual WebP tiles from mansion_alternates.png.
 * Run once: npm run generate-mansion-tiles
 * Re-run whenever new mansion designs are added to the sprite sheet.
 */
import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, '../public/assets/mansion_alternates.png');
const OUT_DIR = join(__dirname, '../public/assets/mansions');

const SHEET_COLS = 5;
const SHEET_ROWS = 6;

// Red background removal: same threshold as the original JS filter
const BG_R = 255, BG_G = 0, BG_B = 0;
const THRESHOLD = 155;

mkdirSync(OUT_DIR, { recursive: true });

const meta = await sharp(SRC).metadata();
const W = meta.width;
const H = meta.height;
const tileW = Math.floor(W / SHEET_COLS);
const tileH = Math.floor(H / SHEET_ROWS);

console.log(`Sprite sheet: ${W}×${H}, tile size: ${tileW}×${tileH}`);

let count = 0;
for (let row = 0; row < SHEET_ROWS - 1; row++) {
  // Skip last row (row 5 is empty in the 5×6 sheet with only 25 variants)
  for (let col = 0; col < SHEET_COLS; col++) {
    const topSkip = row > 0 ? Math.round(tileH * 0.05) : 0;
    const sx = col * tileW;
    const sy = row * tileH + topSkip;
    const sh = tileH - topSkip;

    // Extract tile as raw RGBA
    const { data, info } = await sharp(SRC)
      .extract({ left: sx, top: sy, width: tileW, height: sh })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Remove red background (same euclidean logic as the browser filter)
    const buf = Buffer.from(data);
    for (let i = 0; i < buf.length; i += 4) {
      const r = buf[i], g = buf[i + 1], b = buf[i + 2];
      const dist = Math.sqrt((r - BG_R) ** 2 + (g - BG_G) ** 2 + (b - BG_B) ** 2);
      if (dist <= THRESHOLD) buf[i + 3] = 0;
    }

    const outPath = join(OUT_DIR, `mansion_${row}_${col}.webp`);
    await sharp(buf, { raw: { width: info.width, height: info.height, channels: 4 } })
      .webp({ lossless: false, quality: 90, alphaQuality: 100 })
      .toFile(outPath);

    count++;
    process.stdout.write(`  Saved mansion_${row}_${col}.webp\n`);
  }
}

console.log(`\nDone! Generated ${count} mansion tiles in public/assets/mansions/`);
