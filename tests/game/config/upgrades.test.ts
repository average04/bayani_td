import { describe, it, expect } from 'vitest';
import { effectiveStats, canUpgradePath, nextUpgrade, UPGRADES } from '../../../src/game/config/upgrades';
import { HERO_TYPES } from '../../../src/game/config/heroes';

const lapu = HERO_TYPES.lapulapu;

describe('upgrades', () => {
  it('defines 2 paths of 4 levels for lapulapu', () => {
    expect(UPGRADES.lapulapu).toHaveLength(2);
    expect(UPGRADES.lapulapu[0].levels).toHaveLength(4);
    expect(UPGRADES.lapulapu[1].levels).toHaveLength(4);
  });

  it('effectiveStats applies purchased deltas cumulatively', () => {
    expect(effectiveStats(lapu, [0, 0]).damage).toBe(lapu.damage);
    const a2 = effectiveStats(lapu, [2, 0]);
    expect(a2.damage).toBe(lapu.damage + 12 + 20);
    expect(a2.range).toBe(lapu.range + 10);
    const b4 = effectiveStats(lapu, [0, 4]);
    expect(b4.fireRate).toBeCloseTo(lapu.fireRate + 0.3 + 0.4 + 0.5);
    expect(b4.slow).toEqual({ factor: 0.5, duration: 1.5 });
  });

  it('canUpgradePath enforces the one-path-past-2 rule', () => {
    expect(canUpgradePath([0, 0], 0)).toBe(true);
    expect(canUpgradePath([2, 2], 0)).toBe(true);
    expect(canUpgradePath([2, 3], 0)).toBe(false);
    expect(canUpgradePath([3, 2], 1)).toBe(false);
    expect(canUpgradePath([3, 2], 0)).toBe(true);
    expect(canUpgradePath([4, 2], 0)).toBe(false);
  });

  it('nextUpgrade returns the next level or null', () => {
    expect(nextUpgrade(lapu, [0, 0], 0)?.cost).toBe(60);
    expect(nextUpgrade(lapu, [4, 0], 0)).toBeNull();
    expect(nextUpgrade({ ...HERO_TYPES.gabriela, id: 'nobody' }, [0, 0], 0)).toBeNull(); // no UPGRADES entry
  });

  it('every authored hero has 2 paths of 4 levels with positive costs', () => {
    for (const [id, u] of Object.entries(UPGRADES)) {
      expect(HERO_TYPES[id], `${id} should be a real hero`).toBeDefined();
      expect(u).toHaveLength(2);
      for (const path of u) {
        expect(path.levels).toHaveLength(4);
        for (const lvl of path.levels) expect(lvl.cost).toBeGreaterThan(0);
      }
    }
  });
});
