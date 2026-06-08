import { PNG } from 'pngjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

// Writes a horizontal sprite sheet. colorFn(frame, x, y, w, h) -> [r,g,b,a].
function writeSheet(path, frameW, frameH, frameCount, colorFn) {
  const png = new PNG({ width: frameW * frameCount, height: frameH });
  for (let y = 0; y < frameH; y++) {
    for (let x = 0; x < png.width; x++) {
      const frame = Math.floor(x / frameW);
      const fx = x % frameW;
      const [r, g, b, a] = colorFn(frame, fx, y, frameW, frameH);
      const i = (png.width * y + x) << 2;
      png.data[i] = r;
      png.data[i + 1] = g;
      png.data[i + 2] = b;
      png.data[i + 3] = a;
    }
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, PNG.sync.write(png));
  console.log('wrote', path);
}

// Character sheet: solid body with a transparent 1px edge and a white bar that
// moves with the frame index so the animation is visibly different per frame.
function characterColorFn([r, g, b]) {
  return (frame, x, y, w, h) => {
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1) return [0, 0, 0, 0];
    const barY = 5 + (frame % 4) * 5;
    if (y >= barY && y < barY + 3 && x >= 8 && x < w - 8) return [255, 255, 255, 255];
    return [r, g, b, 255];
  };
}

// Hit puff: expanding white ring over 4 frames on transparent bg.
function puffColorFn(frame, x, y, w, h) {
  const cx = w / 2 - 0.5;
  const cy = h / 2 - 0.5;
  const dist = Math.hypot(x - cx, y - cy);
  const radius = 2 + frame * 3;
  return Math.abs(dist - radius) < 1.5 ? [255, 240, 180, 255] : [0, 0, 0, 0];
}

const CHARS = {
  lapulapu: [0xff, 0xcf, 0x5c],
  gabriela: [0x5c, 0xc7, 0xff],
  aswang: [0xc0, 0x39, 0x2b],
  tiktik: [0x8e, 0x44, 0xad],
};

for (const [key, color] of Object.entries(CHARS)) {
  writeSheet(`public/assets/sprites/${key}.png`, 32, 32, 13, characterColorFn(color));
}

writeSheet(`public/assets/fx/hit-puff.png`, 16, 16, 4, puffColorFn);
writeSheet(`public/assets/fx/projectile.png`, 8, 8, 1, (_f, x, y, w, h) => {
  const d = Math.hypot(x - (w / 2 - 0.5), y - (h / 2 - 0.5));
  return d < 3 ? [255, 230, 120, 255] : [0, 0, 0, 0];
});

// Map tiles (32x32). Ground = green w/ subtle checker; path = brown; build = faint outline.
writeSheet(`public/assets/map/ground.png`, 32, 32, 1, (_f, x, y) => {
  const shade = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0 ? 0 : 12;
  return [40 + shade, 74 + shade, 50 + shade, 255];
});
writeSheet(`public/assets/map/path-tile.png`, 32, 32, 1, (_f, x, y) => {
  const shade = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0 ? 0 : 14;
  return [90 + shade, 70 + shade, 48 + shade, 255];
});
writeSheet(`public/assets/map/build-marker.png`, 32, 32, 1, (_f, x, y, w, h) => {
  const edge = x < 2 || y < 2 || x >= w - 2 || y >= h - 2;
  return edge ? [120, 200, 130, 180] : [0, 0, 0, 0];
});
