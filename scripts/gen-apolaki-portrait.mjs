// Generates Apolaki's UI portrait: a fierce radiant sun emblem (Apolaki is the Tagalog sun
// & war god — the eight-ray sun nods to the Philippine flag). Procedural, matches the
// dark-backdrop look of the other portraits. Run: node scripts/gen-apolaki-portrait.mjs
import { PNG } from 'pngjs';
import { writeFileSync } from 'node:fs';

const S = 512;
const png = new PNG({ width: S, height: S });

const cx = S / 2, cy = S * 0.46;
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => {
  const r = lerp((c1 >> 16) & 255, (c2 >> 16) & 255, t);
  const g = lerp((c1 >> 8) & 255, (c2 >> 8) & 255, t);
  const b = lerp(c1 & 255, c2 & 255, t);
  return [r, g, b];
};
const hash = (x, y) => { const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return n - Math.floor(n); };

// 8 primary rays (Philippine sun) + 8 short rays between, as angular "spikiness"
function rayBoost(ang, dist, R) {
  const a8 = Math.abs(Math.cos(ang * 4)); // 8 lobes
  const a16 = Math.abs(Math.cos(ang * 8 + Math.PI / 2)); // 8 between
  const long = Math.pow(a8, 18) * R * 0.95;
  const short = Math.pow(a16, 22) * R * 0.45;
  return Math.max(long, short);
}

for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    const dx = x - cx, dy = y - cy;
    const dist = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx);
    const R = S * 0.21; // sun disc radius

    // backdrop: deep brown vignette like the other portraits
    const edge = Math.hypot((x - S / 2) / (S / 2), (y - S / 2) / (S / 2));
    let [r, g, b] = mix(0x2a1708, 0x140a04, Math.min(1, edge * 1.15));
    // faint warm glow around the sun
    const glow = Math.max(0, 1 - dist / (S * 0.46));
    [r, g, b] = mix((r << 16) | (g << 8) | b, 0x8a5a18, glow * glow * 0.8).map(Math.round);

    const spike = rayBoost(ang, dist, R);
    if (dist < R + spike) {
      if (dist > R) {
        // inside a ray: gradient hot at base -> deep gold at tip
        const t = (dist - R) / (spike || 1);
        [r, g, b] = mix(0xffd166, 0xb86d14, t);
        const e = (R + spike - dist) / 14;
        if (e < 1) [r, g, b] = mix(0x6b3c0c, (r << 16) | (g << 8) | (b | 0), Math.max(0, e)); // dark ray edge
      } else {
        // inside the disc: radial shading, brightest upper-left
        const lit = Math.max(0, 1 - Math.hypot(dx + R * 0.35, dy + R * 0.35) / (R * 1.7));
        [r, g, b] = mix(0xe8a01e, 0xffe9a3, lit);
        if (dist > R - 7) [r, g, b] = mix((r << 16) | (g << 8) | b, 0x8a4d10, (dist - (R - 7)) / 7); // rim
      }
      // speckle for texture
      const n = hash(x, y) * 14 - 7;
      r += n; g += n * 0.8; b += n * 0.4;
    }

    const i = (S * y + x) << 2;
    png.data[i] = Math.max(0, Math.min(255, Math.round(r)));
    png.data[i + 1] = Math.max(0, Math.min(255, Math.round(g)));
    png.data[i + 2] = Math.max(0, Math.min(255, Math.round(b)));
    png.data[i + 3] = 255;
  }
}

// the war god's face on the disc: stern brows, closed fierce eyes, straight mouth
function blot(x0, y0, w, h, hex, soft = 1.2) {
  for (let y = Math.floor(y0 - h); y <= y0 + h; y++) {
    for (let x = Math.floor(x0 - w); x <= x0 + w; x++) {
      const d = Math.hypot((x - x0) / w, (y - y0) / h);
      if (d > 1) continue;
      const a = Math.min(1, (1 - d) * soft);
      const i = (S * y + x) << 2;
      const [r, g, b] = mix((png.data[i] << 16) | (png.data[i + 1] << 8) | png.data[i + 2], hex, a);
      png.data[i] = Math.round(r); png.data[i + 1] = Math.round(g); png.data[i + 2] = Math.round(b);
    }
  }
}
const R = S * 0.21;
const fy = cy - R * 0.1;
// angled brows (war-god scowl)
for (let t = 0; t <= 1; t += 0.02) {
  blot(cx - R * 0.52 + t * R * 0.36, fy - R * 0.30 + t * R * 0.14, 7, 5, 0x7a4310);
  blot(cx + R * 0.52 - t * R * 0.36, fy - R * 0.30 + t * R * 0.14, 7, 5, 0x7a4310);
}
// eyes: heavy lids
blot(cx - R * 0.33, fy - R * 0.08, R * 0.17, 5.5, 0x6b3a0c);
blot(cx + R * 0.33, fy - R * 0.08, R * 0.17, 5.5, 0x6b3a0c);
// nose
for (let t = 0; t <= 1; t += 0.02) blot(cx, fy - R * 0.05 + t * R * 0.3, 4, 4, 0xc07c16);
blot(cx, fy + R * 0.27, R * 0.09, 5, 0x8a4d10);
// stern mouth
blot(cx, fy + R * 0.52, R * 0.26, 5, 0x6b3a0c);
blot(cx, fy + R * 0.60, R * 0.16, 4, 0xc8861a);

writeFileSync('public/assets/ui/portrait-apolaki.png', PNG.sync.write(png));
console.log(`portrait-apolaki.png written (${S}x${S})`);
