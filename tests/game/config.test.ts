import { describe, it, expect } from 'vitest';
import { ENEMY_TYPES, scaledMaxHp, HP_GROWTH_PER_WAVE } from '../../src/game/config/enemies';
import { HERO_TYPES } from '../../src/game/config/heroes';
import { WAVES, generateWave } from '../../src/game/config/waves';

describe('config data', () => {
  it('includes the new heroes and enemies', () => {
    for (const id of ['bernardo', 'diwata', 'mangkukulam']) expect(HERO_TYPES[id]).toBeDefined();
    for (const id of ['kapre', 'tiyanak', 'manananggal']) expect(ENEMY_TYPES[id]).toBeDefined();
  });

  it('scales enemy HP up each wave, leaving wave 1 at base', () => {
    expect(scaledMaxHp(60, 1)).toBe(60); // no growth on the first wave
    expect(scaledMaxHp(60, 2)).toBe(Math.round(60 * (1 + HP_GROWTH_PER_WAVE)));
    expect(scaledMaxHp(60, 11)).toBe(Math.round(60 * (1 + HP_GROWTH_PER_WAVE * 10)));
    // up to wave 20 it is the gentle linear ramp
    expect(scaledMaxHp(60, 20)).toBe(Math.round(60 * (1 + HP_GROWTH_PER_WAVE * 19)));
    // monotonic, fixed base unchanged
    expect(scaledMaxHp(60, 30)).toBeGreaterThan(scaledMaxHp(60, 10));
  });

  it('ramps HP much faster past wave 20 (compounding)', () => {
    const linearAt30 = Math.round(60 * (1 + HP_GROWTH_PER_WAVE * 29));
    expect(scaledMaxHp(60, 30)).toBeGreaterThan(linearAt30); // late ramp adds on top of linear
    // the per-wave HP jump is bigger in the late game than the early game
    const lateJump = scaledMaxHp(60, 31) - scaledMaxHp(60, 30);
    const earlyJump = scaledMaxHp(60, 11) - scaledMaxHp(60, 10);
    expect(lateJump).toBeGreaterThan(earlyJump);
  });

  it('ramps HP even steeper past wave 30 (deep-wave wall)', () => {
    // a wave-by-wave jump just past 30 outpaces one just past 20 (steeper tier kicks in)
    const deepJump = scaledMaxHp(60, 31) - scaledMaxHp(60, 30);
    const lateJump = scaledMaxHp(60, 21) - scaledMaxHp(60, 20);
    expect(deepJump).toBeGreaterThan(lateJump);
    // and the wall is dramatic by deep waves: well past 20x the base by wave 40
    expect(scaledMaxHp(60, 40)).toBeGreaterThan(60 * 20);
  });

  it('endless wave counts grow slowly and cap (HP carries difficulty, not quantity)', () => {
    const total = (n: number): number => generateWave(n).spawns.reduce((s, sp) => s + sp.count, 0);
    expect(total(17)).toBeLessThan(total(30)); // still grows past the authored list
    expect(total(30)).toBeLessThan(120); // but far fewer than the old runaway counts (was ~260)
    expect(total(80)).toBe(total(200)); // counts plateau in deep waves
  });

  it('every wave spawn references a defined enemy type with a positive count', () => {
    for (const wave of WAVES) {
      for (const spawn of wave.spawns) {
        expect(ENEMY_TYPES[spawn.enemyTypeId], spawn.enemyTypeId).toBeDefined();
        expect(spawn.count).toBeGreaterThan(0);
      }
    }
  });
});
