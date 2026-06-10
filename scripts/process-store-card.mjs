// One-off: turn the downloaded sari-sari store render into the store build-card art.
// Flood-fills the white background to transparent (preserving interior whites like the
// awning stripes), feathers the edge, auto-crops, and writes public/assets/ui/portrait-store.png.
// Run: node scripts/process-store-card.mjs "<source.png>"
import { PNG } from 'pngjs';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const SRC = process.argv[2];
if (!SRC) {
  console.error('usage: node scripts/process-store-card.mjs "<source.png>"');
  process.exit(1);
}

const png = PNG.sync.read(readFileSync(SRC));
const { width: W, height: H, data } = png;
const idx = (x, y) => (W * y + x) << 2;
const minRGB = (i) => Math.min(data[i], data[i + 1], data[i + 2]);

// 1) Flood-fill near-white background from the borders.
const T_BG = 232; // a pixel this bright (all channels) counts as background-ish
const bg = new Uint8Array(W * H);
const stack = [];
const pushIf = (x, y) => {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const p = W * y + x;
  if (bg[p]) return;
  if (minRGB(p << 2) >= T_BG) { bg[p] = 1; stack.push(x, y); }
};
for (let x = 0; x < W; x++) { pushIf(x, 0); pushIf(x, H - 1); }
for (let y = 0; y < H; y++) { pushIf(0, y); pushIf(W - 1, y); }
while (stack.length) {
  const y = stack.pop(), x = stack.pop();
  pushIf(x + 1, y); pushIf(x - 1, y); pushIf(x, y + 1); pushIf(x, y - 1);
}

// 2) Apply transparency. Background -> alpha 0. Edge feather: non-bg pixels touching the
//    background that are still pale get partial alpha so there's no white halo.
const T_FEATHER = 200;
const out = new PNG({ width: W, height: H });
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const p = W * y + x, i = p << 2;
  out.data[i] = data[i]; out.data[i + 1] = data[i + 1]; out.data[i + 2] = data[i + 2];
  if (bg[p]) { out.data[i + 3] = 0; continue; }
  let a = data[i + 3];
  const m = minRGB(i);
  if (m >= T_FEATHER) {
    const nearBg = bg[W * y + Math.min(W - 1, x + 1)] || bg[W * y + Math.max(0, x - 1)] ||
                   bg[W * Math.min(H - 1, y + 1) + x] || bg[W * Math.max(0, y - 1) + x];
    if (nearBg) {
      const t = Math.max(0, Math.min(1, (T_BG - m) / (T_BG - T_FEATHER)));
      a = Math.round(a * t);
    }
  }
  out.data[i + 3] = a;
}

// 3) Auto-crop to the opaque bounding box (small padding).
let minX = W, minY = H, maxX = 0, maxY = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (out.data[((W * y + x) << 2) + 3] > 16) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
}
const pad = 6;
minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
maxX = Math.min(W - 1, maxX + pad); maxY = Math.min(H - 1, maxY + pad);
const cw = maxX - minX + 1, ch = maxY - minY + 1;
const cropped = new PNG({ width: cw, height: ch });
for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
  const si = (W * (y + minY) + (x + minX)) << 2, di = (cw * y + x) << 2;
  for (let c = 0; c < 4; c++) cropped.data[di + c] = out.data[si + c];
}

mkdirSync('public/assets/ui', { recursive: true });
writeFileSync('public/assets/ui/portrait-store.png', PNG.sync.write(cropped));
console.log(`wrote public/assets/ui/portrait-store.png (${cw}x${ch}) from ${W}x${H}`);

// preview on a checkerboard so transparency is visible
const prev = new PNG({ width: cw, height: ch });
for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
  const di = (cw * y + x) << 2, si = di;
  const c = (((x / 12) | 0) + ((y / 12) | 0)) & 1 ? 80 : 120;
  const a = cropped.data[si + 3] / 255;
  for (let k = 0; k < 3; k++) prev.data[di + k] = Math.round(cropped.data[si + k] * a + c * (1 - a));
  prev.data[di + 3] = 255;
}
writeFileSync('d:/tmp/store-card-preview.png', PNG.sync.write(prev));
console.log('wrote d:/tmp/store-card-preview.png');
