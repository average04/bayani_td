// Generates pixel-art for the Sari-Sari Store into public/assets/map/store.png
// (96x72; the bottom ~48px sits in the 4x2 footprint, the roof/sign rise above).
// Also writes a checker-bg preview to d:/tmp/store-art.png. Run: node scripts/gen-store-art.mjs
import { PNG } from 'pngjs';
import { mkdirSync, writeFileSync } from 'node:fs';

const W = 96, H = 72;
const png = new PNG({ width: W, height: H });
png.data.fill(0); // transparent

function px(x, y, hex, a = 1) {
  if (x < 0 || y < 0 || x >= W || y >= H || a <= 0) return;
  const i = (W * y + x) << 2;
  const r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255;
  const da = png.data[i + 3] / 255;
  const oa = a + da * (1 - a);
  png.data[i] = Math.round((r * a + png.data[i] * da * (1 - a)) / (oa || 1));
  png.data[i + 1] = Math.round((g * a + png.data[i + 1] * da * (1 - a)) / (oa || 1));
  png.data[i + 2] = Math.round((b * a + png.data[i + 2] * da * (1 - a)) / (oa || 1));
  png.data[i + 3] = Math.round(oa * 255);
}
const rect = (x, y, w, h, hex, a = 1) => {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) px(xx, yy, hex, a);
};
const hash = (x, y, s = 0) => { const n = Math.sin(x * 12.9 + y * 78.2 + s * 37.1) * 43758.5; return n - Math.floor(n); };

// ground shadow
for (let yy = 64; yy < 72; yy++) for (let xx = 0; xx < W; xx++) {
  const dx = (xx - W / 2) / 45, dy = (yy - 68) / 4.5;
  if (dx * dx + dy * dy < 1) px(xx, yy, 0x000000, 0.25);
}

// wall + posts
const wallTop = 30, wallBot = 67;
rect(8, wallTop, W - 16, wallBot - wallTop, 0xddc6a0);
for (let yy = wallTop; yy < wallBot; yy++) for (let xx = 8; xx < W - 8; xx++) {
  if (xx > W - 18) px(xx, yy, 0x000000, 0.12); // shaded right
  if (hash(xx, yy, 3) > 0.93) px(xx, yy, 0x000000, 0.06); // speckle
}
rect(6, wallTop, 4, wallBot - wallTop + 2, 0x6e4a28);
rect(W - 10, wallTop, 4, wallBot - wallTop + 2, 0x6e4a28);
rect(6, wallTop, 4, 2, 0x8a5e34);

// counter window
const wx = 16, wy = 40, ww = W - 32, wh = 22;
rect(wx, wy, ww, wh, 0x241a12);
const sachet = [0xff5a5a, 0xffd45a, 0x5ad0ff, 0x8aff7a, 0xff8af0, 0xffffff, 0xff9a3c];
for (let row = 0; row < 2; row++) for (let i = 0; i < 10; i++) {
  const sx = wx + 3 + i * 6, sy = wy + 2 + row * 6;
  rect(sx, sy, 4, 5, sachet[(i + row) % sachet.length]);
  rect(sx, sy, 4, 1, 0xffffff, 0.4); // foil glint
}
rect(wx, wy + wh - 7, ww, 2, 0x4a3320); // shelf
const jar = [0x7ec8a0, 0xd98f4a, 0xcf5a5a, 0xe0c270, 0x9a7ae0];
for (let i = 0; i < 6; i++) {
  const jx = wx + 3 + i * 10;
  rect(jx, wy + wh - 6, 5, 5, jar[i % jar.length]);
  rect(jx, wy + wh - 6, 5, 1, 0xffffff, 0.3);
}
for (let xx = wx; xx < wx + ww; xx += 8) rect(xx, wy, 1, wh, 0x000000, 0.25); // grille bars
rect(wx, wy + 9, ww, 1, 0x000000, 0.22);

// awning (straight stripes, slight overhang)
const ay = 25, ah = 7;
for (let xx = 6; xx < W - 6; xx++) rect(xx, ay, 1, ah, Math.floor((xx - 6) / 6) % 2 === 0 ? 0xd23b3b : 0xf3f0e6);
rect(6, ay + ah, W - 12, 1, 0x000000, 0.25);

// sign board
rect(12, 16, W - 24, 9, 0xe6c25a);
rect(12, 16, W - 24, 2, 0xf2d77a);
for (let xx = 12; xx < W - 12; xx++) { px(xx, 16, 0x7a3b1a); px(xx, 24, 0x7a3b1a); }
for (let yy = 16; yy < 25; yy++) { px(12, yy, 0x7a3b1a); px(W - 13, yy, 0x7a3b1a); }
for (let i = 0; i < 5; i++) rect(19 + i * 12, 19, 8, 3, 0xb5402a); // suggestion of lettering

// roof (corrugated, overhanging)
const ry = 4, rh = 12;
rect(2, ry, W - 4, rh, 0xa8412c);
for (let xx = 2; xx < W - 2; xx += 4) rect(xx, ry, 2, rh, 0xbf5238);
rect(2, ry, W - 4, 2, 0xc4543c);
rect(2, ry + rh - 2, W - 4, 2, 0x7a2c1c);

mkdirSync('public/assets/map', { recursive: true });
writeFileSync('public/assets/map/store.png', PNG.sync.write(png));
console.log('wrote public/assets/map/store.png (96x72)');

// preview on a checker bg
const S = 4, prev = new PNG({ width: W * S, height: H * S });
for (let y = 0; y < prev.height; y++) for (let x = 0; x < prev.width; x++) {
  const i = (prev.width * y + x) << 2;
  const c = (((x / 16) | 0) + ((y / 16) | 0)) & 1 ? 70 : 100;
  prev.data[i] = c; prev.data[i + 1] = c; prev.data[i + 2] = c; prev.data[i + 3] = 255;
}
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const si = (W * y + x) << 2, a = png.data[si + 3] / 255;
  if (a === 0) continue;
  for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
    const di = (prev.width * (y * S + sy) + (x * S + sx)) << 2;
    for (let c = 0; c < 3; c++) prev.data[di + c] = Math.round(png.data[si + c] * a + prev.data[di + c] * (1 - a));
  }
}
writeFileSync('d:/tmp/store-art.png', PNG.sync.write(prev));
console.log('wrote d:/tmp/store-art.png');
