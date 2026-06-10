import { describe, it, expect } from 'vitest';
import { World, type WorldConfig } from '../../src/game/world';
import type { LevelConfig } from '../../src/game/config/levels';
import type { EnemyType } from '../../src/game/config/enemies';
import { HERO_TYPES } from '../../src/game/config/heroes';
import { STORE } from '../../src/game/config/store';
import { Enemy } from '../../src/game/entities/enemy';

// a never-moving, never-dying enemy used to keep a wave "in progress" (blocks auto-start/win)
const blocker: EnemyType = { id: 'blocker', name: 'B', maxHp: 1e6, speed: 0, reward: 0, leakDamage: 1 };

const level: LevelConfig = {
  id: 't', name: 'T', tileSize: 48, cols: 16, rows: 10, cellSize: 24,
  path: [{ x: 0, y: 0 }, { x: 700, y: 0 }],
  startingGold: 1000, startingLives: 20,
};
// one (unstarted) wave keeps the game in the 'playing' state during update()
const cfg = (gold = 1000): WorldConfig => ({
  level: { ...level, startingGold: gold },
  enemyTypes: {},
  heroTypes: HERO_TYPES,
  waves: [{ spawns: [] }],
});

describe('Sari-Sari store', () => {
  it('places a 4x2 store, charges its cost, and occupies its cells', () => {
    const w = new World(cfg());
    expect(w.placeStore(4, 4)).toBe(true);
    expect(w.gold).toBe(1000 - STORE.cost);
    expect(w.stores).toHaveLength(1);
    expect(w.placeTower('lapulapu', 4, 4)).toBe(false); // a tower can't overlap the store
  });

  it('generates income on its interval while playing', () => {
    const w = new World(cfg());
    w.placeStore(4, 4); // gold 1000 - 150 = 850
    w.enemies.push(new Enemy(blocker, level.path)); // keep a wave active so it doesn't auto-start/win
    w.update(STORE.incomeInterval - 0.1); // before a payout
    expect(w.gold).toBe(850);
    w.update(0.2); // crosses the interval
    expect(w.gold).toBe(850 + STORE.incomeAmount);
  });

  it('finds and sells a store for a 70% refund, freeing its cells', () => {
    const w = new World(cfg());
    w.placeStore(4, 4);
    const found = w.storeAt(w.stores[0].pos.x, w.stores[0].pos.y);
    expect(found).toBe(w.stores[0]);
    expect(w.sellStore(w.stores[0])).toBe(Math.floor(STORE.cost * STORE.sellRefund));
    expect(w.stores).toHaveLength(0);
    expect(w.placeStore(4, 4)).toBe(true); // cells were freed
  });

  it('upgrades the tick path for bigger payouts', () => {
    const w = new World(cfg());
    w.placeStore(4, 4); // gold 850
    const st = w.stores[0];
    expect(w.upgradeStore(st, 0)).toBe(true); // Bulk Goods +5, cost 200
    expect(w.gold).toBe(850 - 200);
    expect(st.income.tickAmount).toBe(STORE.incomeAmount + 5);
    w.update(STORE.incomeInterval); // a payout
    expect(w.gold).toBe(850 - 200 + STORE.incomeAmount + 5);
  });

  it('upgrades the passive path for a per-second drip', () => {
    const w = new World(cfg());
    w.placeStore(4, 4);
    const st = w.stores[0];
    w.upgradeStore(st, 1); // Regulars +1/s, cost 220
    expect(st.income.passivePerSec).toBe(1);
    const before = w.gold;
    w.update(1); // one passive second (under the 5s tick interval)
    expect(w.gold).toBe(before + 1);
  });

  it('enforces the cross-path lock on store upgrades', () => {
    const w = new World(cfg(5000));
    w.placeStore(4, 4);
    const st = w.stores[0];
    st.upgrade(0); st.upgrade(0); st.upgrade(0); // tick path -> 3
    st.upgrade(1); st.upgrade(1); // passive path -> 2
    expect(w.canUpgradeStore(st, 1)).toBe(false); // passive can't pass 2 while tick is 3
    expect(w.canUpgradeStore(st, 0)).toBe(true);
  });
});
