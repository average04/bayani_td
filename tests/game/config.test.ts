import { describe, it, expect } from 'vitest';
import { ENEMY_TYPES, scaledMaxHp, HP_GROWTH_PER_WAVE } from '../../src/game/config/enemies';
import { HERO_TYPES } from '../../src/game/config/heroes';
import { WAVES } from '../../src/game/config/waves';

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

  it('every wave spawn references a defined enemy type with a positive count', () => {
    for (const wave of WAVES) {
      for (const spawn of wave.spawns) {
        expect(ENEMY_TYPES[spawn.enemyTypeId], spawn.enemyTypeId).toBeDefined();
        expect(spawn.count).toBeGreaterThan(0);
      }
    }
  });
});
