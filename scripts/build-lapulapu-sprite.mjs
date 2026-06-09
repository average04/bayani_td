// Composites a dressed, bolo-wielding Lapu-Lapu spritesheet from makrohn LPC layers
// (https://github.com/makrohn/Universal-LPC-spritesheet) into
// public/assets/sprites/lapulapu/sheet.png — the classic 64x64, 273-frame universal layout.
// All layers share the 832x1344 grid, so they alpha-composite without offsets.
// Run: node scripts/build-lapulapu-sprite.mjs
import { PNG } from 'pngjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const BASE = 'https://raw.githubusercontent.com/makrohn/Universal-LPC-spritesheet/master';

// Layers in z-order, back -> front. Each is a full 832x1344 universal sheet.
const LAYERS = [
  'body/male/tanned2.png', // tanned warrior body (includes head/face)
  'legs/skirt/male/robe_skirt_male.png', // lower-body wrap
  'torso/leather/chest_male.png', // leather chest / vest
  'hair/male/bangsshort/black.png', // short black hair
  'head/bandanas/male/red.png', // red headband / bandana
  'weapons/right hand/male/dagger_male.png', // bolo (stands in his right hand during the swing)
];

async function fetchPng(path) {
  const url = `${BASE}/${path.split('/').map(encodeURIComponent).join('/')}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${path}: HTTP ${res.status}`);
  return PNG.sync.read(Buffer.from(await res.arrayBuffer()));
}

// source-over alpha composite of src onto dst (both RGBA, same dimensions)
function composite(dst, src) {
  const d = dst.data;
  const s = src.data;
  for (let i = 0; i < d.length; i += 4) {
    const sa = s[i + 3] / 255;
    if (sa === 0) continue;
    const da = d[i + 3] / 255;
    const oa = sa + da * (1 - sa);
    for (let c = 0; c < 3; c++) {
      d[i + c] = Math.round((s[i + c] * sa + d[i + c] * da * (1 - sa)) / oa);
    }
    d[i + 3] = Math.round(oa * 255);
  }
}

const layers = [];
for (const p of LAYERS) {
  const png = await fetchPng(p);
  console.log(`  ${png.width}x${png.height}  ${p}`);
  layers.push({ p, png });
}

const { width: W, height: H } = layers[0].png;
for (const { p, png } of layers) {
  if (png.width !== W || png.height !== H) {
    throw new Error(`size mismatch on ${p}: ${png.width}x${png.height} != ${W}x${H}`);
  }
}

const out = new PNG({ width: W, height: H });
out.data.fill(0);
for (const { png } of layers) composite(out, png);

const dest = 'public/assets/sprites/lapulapu/sheet.png';
mkdirSync(dirname(dest), { recursive: true });
writeFileSync(dest, PNG.sync.write(out));
console.log(`wrote ${dest} (${W}x${H}, ${(W / 64) * (H / 64)} frames)`);
