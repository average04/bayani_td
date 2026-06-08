import { describe, it, expect } from 'vitest';
import { MANIFEST } from '../../src/assets/manifest';

describe('asset manifest', () => {
  it('has the four expected characters with unique keys', () => {
    const keys = MANIFEST.characters.map((c) => c.key).sort();
    expect(keys).toEqual(['aswang', 'gabriela', 'lapulapu', 'tiktik']);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('defines idle/walk/attack/death within frame bounds for each character', () => {
    for (const c of MANIFEST.characters) {
      expect(c.frameCount).toBeGreaterThan(0);
      for (const state of ['idle', 'walk', 'attack', 'death'] as const) {
        const a = c.anims[state];
        expect(a.start).toBeGreaterThanOrEqual(0);
        expect(a.end).toBeGreaterThanOrEqual(a.start);
        expect(a.end).toBeLessThan(c.frameCount);
        expect(a.frameRate).toBeGreaterThan(0);
      }
    }
  });

  it('points every asset path under assets/', () => {
    const paths = [
      ...MANIFEST.characters.map((c) => c.path),
      MANIFEST.fx.projectile.path,
      MANIFEST.fx.hitPuff.path,
      MANIFEST.map.ground.path,
      MANIFEST.map.pathTile.path,
      MANIFEST.map.buildMarker.path,
    ];
    for (const p of paths) expect(p.startsWith('assets/')).toBe(true);
  });
});
