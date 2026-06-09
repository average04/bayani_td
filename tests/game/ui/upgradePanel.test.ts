import { describe, it, expect } from 'vitest';
import { buildUpgradePanel } from '../../../src/ui/uiState';
import { HERO_TYPES } from '../../../src/game/config/heroes';

describe('buildUpgradePanel', () => {
  it('returns null for a hero with no upgrades', () => {
    expect(buildUpgradePanel('gabriela', [0, 0], 1000)).toBeNull();
  });

  it('reports the current effective stats', () => {
    const lapu = HERO_TYPES.lapulapu;
    const base = buildUpgradePanel('lapulapu', [0, 0], 1000)!;
    expect(base.stats).toEqual({ damage: lapu.damage, range: lapu.range, fireRate: lapu.fireRate, effect: 'Melee spin' });
    const upgraded = buildUpgradePanel('lapulapu', [2, 0], 1000)!;
    expect(upgraded.stats.damage).toBe(lapu.damage + 12 + 20);
    expect(upgraded.stats.range).toBe(lapu.range + 10);
  });

  it('describes both paths with the next upgrade and affordability', () => {
    const vm = buildUpgradePanel('lapulapu', [0, 0], 1000)!;
    expect(vm.heroName).toBe('Lapu-Lapu');
    expect(vm.paths[0].name).toBe('Conqueror');
    expect(vm.paths[0].level).toBe(0);
    expect(vm.paths[0].next).toEqual({ name: 'Sharpened Bolo', cost: 60 });
    expect(vm.paths[0].canBuy).toBe(true);
  });

  it('marks an upgrade unaffordable and a rule-locked path', () => {
    const poor = buildUpgradePanel('lapulapu', [0, 0], 10)!;
    expect(poor.paths[0].canBuy).toBe(false); // can't afford 60
    const locked = buildUpgradePanel('lapulapu', [3, 2], 1000)!;
    expect(locked.paths[1].locked).toBe(true); // B can't pass 2 while A is 3
    expect(locked.paths[1].canBuy).toBe(false);
  });

  it('shows a maxed path as next=null', () => {
    const vm = buildUpgradePanel('lapulapu', [4, 2], 1000)!;
    expect(vm.paths[0].next).toBeNull();
  });
});
