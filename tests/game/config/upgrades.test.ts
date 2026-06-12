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
    expect(b4.slow).toEqual({ factor: 0.7, duration: 1.5 }); // light slow only — deep chill is Diwata's
  });

  it('Mangkukulam: Dark Arts vials inherit the flat poison from the Curse tiers', () => {
    const witch = HERO_TYPES.mangkukulam;
    // Wasting Curse (L2) sets the flat 18/s; Deadly Vials/Malediction only add splash + HP-burn
    const s = effectiveStats(witch, [2, 4]);
    expect(s.splashRadius).toBe(45);
    expect(s.poison).toEqual({ dps: 18, duration: 8, hpFracPerSec: 0.02 });
    // without Curse investment the vials ride on the base 8/s
    const vialsOnly = effectiveStats(witch, [0, 3]);
    expect(vialsOnly.poison).toEqual({ dps: 8, duration: 7, hpFracPerSec: 0.015 });
  });

  it('Diwata: splash and root only unlock at tier 3, so she gets one or the other', () => {
    const diwata = HERO_TYPES.diwata;
    // tiers 1-2 are pure slow / pure damage — no signature effect yet
    expect(effectiveStats(diwata, [2, 0]).splashRadius).toBeUndefined();
    expect(effectiveStats(diwata, [0, 2]).root).toBeUndefined();

    // Deep Chill tier 3+ grants AoE splash (and never root)
    const chill = effectiveStats(diwata, [4, 0]);
    expect(chill.splashRadius).toBe(70 + 40); // unlocked at L3, widened at L4
    expect(chill.slow).toEqual({ factor: 0.22, duration: 3 });
    expect(chill.root).toBeUndefined();

    // Nature's Wrath tier 3+ grants roots (and never splash)
    const wrath = effectiveStats(diwata, [0, 3]);
    expect(wrath.root).toEqual({ chance: 0.4, duration: 1.0 });
    expect(wrath.splashRadius).toBeUndefined();
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
