import { describe, it, expect } from 'vitest';
import { MANIFEST } from '../../src/assets/manifest';

const STATES = ['idle', 'walk', 'attack', 'death'] as const;

describe('asset manifest', () => {
  it('has the four expected characters with unique keys', () => {
    const keys = MANIFEST.characters.map((c) => c.key).sort();
    expect(keys).toEqual(['aswang', 'gabriela', 'lapulapu', 'tiktik']);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('defines idle/walk/attack/death with a down row, in bounds, scaled', () => {
    const sheetByKey = new Map(MANIFEST.sheets.map((s) => [s.key, s]));
    for (const c of MANIFEST.characters) {
      expect(c.displayScale).toBeGreaterThan(0);
      for (const state of STATES) {
        const clip = c.anims[state];
        const sheet = sheetByKey.get(clip.sheet);
        expect(sheet, `sheet ${clip.sheet} exists`).toBeDefined();
        expect(clip.rows.down, `${c.key}.${state} has a down row`).toBeDefined();
        expect(clip.frameRate).toBeGreaterThan(0);
        for (const dir of Object.keys(clip.rows) as Array<'down' | 'up' | 'side'>) {
          const r = clip.rows[dir]!;
          expect(r.start).toBeGreaterThanOrEqual(0);
          expect(r.end).toBeGreaterThanOrEqual(r.start);
          expect(r.end).toBeLessThan(sheet!.frameCount);
        }
      }
    }
  });

  it('points every asset path under assets/', () => {
    const paths = [
      ...MANIFEST.sheets.map((s) => s.path),
      MANIFEST.fx.projectile.path,
      MANIFEST.fx.hitPuff.path,
      MANIFEST.map.ground.path,
      MANIFEST.map.pathTile.path,
      MANIFEST.map.buildMarker.path,
    ];
    for (const p of paths) expect(p.startsWith('assets/')).toBe(true);
  });
});
