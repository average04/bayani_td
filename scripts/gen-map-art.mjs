// Generates nicer map tiles: a seamless-ish grass ground (64x64) and a soft dirt
// path blob (48x48) whose overlapping copies form a smooth path. Also writes a
// preview to d:/tmp/map-preview.png. Run: node scripts/gen-map-art.mjs
import { PNG } from 'pngjs';
import { mkdirSync, writeFileSync } from 'node:fs';

// deterministic per-pixel pseudo-random in [0,1)
function hash(x, y, s) {
  const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
  return n - Math.floor(n);
}
const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));

// ---- grass ground (64x64) ----
function makeGround() {
  const W = 64, png = new PNG({ width: W, height: W });
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const i = (W * y + x) << 2;
    const n = (hash(x, y, 1) - 0.5) * 18;
    let r = 60 + n * 0.4, g = 104 + n, b = 58 + n * 0.4;
    if (hash(x, y, 2) > 0.985) { r += 6; g += 26; b += 10; } // bright blade
    else if (hash(x, y, 3) < 0.02) { r -= 10; g -= 22; b -= 10; } // dark tuft
    png.data[i] = clamp(r); png.data[i + 1] = clamp(g); png.data[i + 2] = clamp(b); png.data[i + 3] = 255;
  }
  return png;
}

// ---- dirt path blob (48x48), radial soft edge + pebbles ----
function makePath() {
  const W = 48, c = (W - 1) / 2, png = new PNG({ width: W, height: W });
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const i = (W * y + x) << 2;
    const d = Math.hypot(x - c, y - c);
    let a = 0;
    if (d < 16) a = 255;
    else if (d < 23) a = 255 * (1 - (d - 16) / 7); // soft falloff 16..23
    const n = (hash(x, y, 4) - 0.5) * 22;
    let r = 132 + n, g = 100 + n * 0.8, b = 66 + n * 0.6;
    if (hash(x, y, 5) > 0.95) { r -= 26; g -= 22; b -= 16; } // pebble shadow
    else if (hash(x, y, 6) > 0.95) { r += 18; g += 14; b += 8; } // light grit
    png.data[i] = clamp(r); png.data[i + 1] = clamp(g); png.data[i + 2] = clamp(b); png.data[i + 3] = clamp(a);
  }
  return png;
}

const ground = makeGround();
const path = makePath();
mkdirSync('public/assets/map', { recursive: true });
writeFileSync('public/assets/map/ground.png', PNG.sync.write(ground));
writeFileSync('public/assets/map/path-tile.png', PNG.sync.write(path));
console.log('wrote ground.png (64x64) + path-tile.png (48x48)');

// ---- preview: tile ground + lay path blobs along a sample polyline ----
const PW = 360, PH = 220, prev = new PNG({ width: PW, height: PH });
for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
  const gi = (64 * (y % 64) + (x % 64)) << 2, di = (PW * y + x) << 2;
  prev.data[di] = ground.data[gi]; prev.data[di + 1] = ground.data[gi + 1]; prev.data[di + 2] = ground.data[gi + 2]; prev.data[di + 3] = 255;
}
const pts = [[20, 110], [160, 110], [160, 50], [330, 50], [330, 170]];
function blob(cx, cy) {
  for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) {
    const px = (cx | 0) - 24 + x, py = (cy | 0) - 24 + y;
    if (px < 0 || py < 0 || px >= PW || py >= PH) continue;
    const si = (48 * y + x) << 2, a = path.data[si + 3] / 255;
    if (a === 0) continue;
    const di = (PW * py + px) << 2;
    for (let c = 0; c < 3; c++) prev.data[di + c] = Math.round(path.data[si + c] * a + prev.data[di + c] * (1 - a));
  }
}
for (let s = 1; s < pts.length; s++) {
  const [ax, ay] = pts[s - 1], [bx, by] = pts[s];
  const len = Math.hypot(bx - ax, by - ay), n = Math.ceil(len / 10);
  for (let k = 0; k <= n; k++) blob(ax + (bx - ax) * (k / n), ay + (by - ay) * (k / n));
}
writeFileSync('d:/tmp/map-preview.png', PNG.sync.write(prev));
console.log('wrote d:/tmp/map-preview.png');
