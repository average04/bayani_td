import { describe, it, expect } from 'vitest';
import { World, type WorldConfig } from '../../src/game/world';
import type { LevelConfig } from '../../src/game/config/levels';
import { HERO_TYPES } from '../../src/game/config/heroes';

const level: LevelConfig = {
  id: 't', name: 'T', tileSize: 48, cols: 16, rows: 10, cellSize: 24,
  path: [{ x: 0, y: 0 }, { x: 700, y: 0 }],
  startingGold: 1000, startingLives: 20,
};
const cfg = (gold = 1000): WorldConfig => ({ level: { ...level, startingGold: gold }, enemyTypes: {}, heroTypes: HERO_TYPES, waves: [] });

describe('World upgrades', () => {
  it('finds the tower under a point via its footprint', () => {
    const w = new World(cfg());
    w.placeTower('lapulapu', 4, 4); // footprint center (120,120)
    expect(w.towerAt(120, 120)).toBe(w.towers[0]);
    expect(w.towerAt(144, 120)).toBe(w.towers[0]); // footprint edge
    expect(w.towerAt(300, 300)).toBeNull();
  });

  it('upgrades a path, spends gold, and applies stats', () => {
    const w = new World(cfg());
    w.placeTower('lapulapu', 4, 4); // -100 -> 900
    const t = w.towers[0];
    expect(w.upgradeTower(t, 0)).toBe(true); // Path A L1 cost 60
    expect(w.gold).toBe(900 - 60);
    expect(t.levels).toEqual([1, 0]);
    expect(t.stats.damage).toBe(HERO_TYPES.lapulapu.damage + 12);
  });

  it('enforces the cross-path lock', () => {
    const w = new World(cfg());
    w.placeTower('lapulapu', 4, 4);
    const t = w.towers[0];
    t.upgrade(0); t.upgrade(0); t.upgrade(0); // A=3
    t.upgrade(1); t.upgrade(1); // B=2
    expect(w.canUpgrade(t, 1)).toBe(false); // B can't reach 3 while A>2
    expect(w.canUpgrade(t, 0)).toBe(true); // A keeps going to 4
  });

  it('refuses an unaffordable upgrade', () => {
    const w = new World(cfg(100));
    w.placeTower('lapulapu', 4, 4); // -100 -> 0
    const t = w.towers[0];
    expect(w.upgradeTower(t, 0)).toBe(false);
    expect(t.levels).toEqual([0, 0]);
  });

  it('sells a tower for a 70% refund and frees its cells', () => {
    const w = new World(cfg());
    w.placeTower('lapulapu', 4, 4); // -100 -> 900
    const t = w.towers[0];
    w.upgradeTower(t, 0); // -60 -> 840; spent = 160
    expect(w.sellValue(t)).toBe(112); // floor(160 * 0.7)
    expect(w.sellTower(t)).toBe(112);
    expect(w.gold).toBe(840 + 112);
    expect(w.towers).toHaveLength(0);
    expect(w.placeTower('lapulapu', 4, 4)).toBe(true); // cells were freed
  });
});
