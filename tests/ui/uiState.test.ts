import { describe, it, expect } from 'vitest';
import { buildUiState, canAfford } from '../../src/ui/uiState';
import type { HeroType } from '../../src/game/config/heroes';

const heroTypes: Record<string, HeroType> = {
  a: { id: 'a', name: 'A', cost: 100, range: 1, damage: 1, fireRate: 1 },
  b: { id: 'b', name: 'B', cost: 50, range: 1, damage: 1, fireRate: 1 },
};
const order = ['a', 'b'];
const world = {
  lives: 20,
  gold: 75,
  waveNumber: 2,
  totalWaves: 6,
  status: 'playing' as const,
  nextWaveIn: 3,
  passiveIncome: 0,
  bossActive: false,
  storeMaxed: false,
};

describe('uiState', () => {
  it('canAfford compares gold to cost', () => {
    expect(canAfford(75, 50)).toBe(true);
    expect(canAfford(40, 50)).toBe(false);
  });

  it('builds a view-model with stats and per-hero affordability/selection', () => {
    const vm = buildUiState(world, 'b', 3, order, heroTypes);
    expect(vm.lives).toBe(20);
    expect(vm.gold).toBe(75);
    expect(vm.wave).toBe(2);
    expect(vm.totalWaves).toBe(6);
    expect(vm.bestWave).toBe(3);
    expect(vm.status).toBe('playing');
    expect(vm.nextWaveIn).toBe(3);
    expect(vm.heroes).toEqual([
      { id: 'a', name: 'A', cost: 100, affordable: false, selected: false },
      { id: 'b', name: 'B', cost: 50, affordable: true, selected: true },
    ]);
    expect(vm.opponent).toBeUndefined();
    expect(vm.sends).toBeUndefined();
  });

  it('includes opponent + send VMs when multiplayer context is given', () => {
    const vm = buildUiState(world, null, 0, order, heroTypes, {
      opponent: { nickname: 'Rival', lives: 12, wave: 4 },
    });
    expect(vm.opponent).toEqual({ nickname: 'Rival', lives: 12, wave: 4 });
    expect(vm.sends!.length).toBeGreaterThan(0);
    const tiyanak = vm.sends!.find((s) => s.id === 'tiyanak')!;
    const kapre = vm.sends!.find((s) => s.id === 'kapre')!;
    expect(tiyanak).toMatchObject({ cost: 25, unlocked: true, affordable: true });
    expect(kapre).toMatchObject({ unlocked: false });
  });
});
