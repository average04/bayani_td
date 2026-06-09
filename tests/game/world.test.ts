import { describe, it, expect } from 'vitest';
import { World } from '../../src/game/world';
import type { WorldConfig } from '../../src/game/world';
import type { LevelConfig } from '../../src/game/config/levels';
import type { EnemyType } from '../../src/game/config/enemies';
import type { HeroType } from '../../src/game/config/heroes';

const level: LevelConfig = {
  id: 'test',
  name: 'Test',
  tileSize: 48,
  cols: 10,
  rows: 4,
  cellSize: 24,
  path: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
  ],
  startingGold: 100,
  startingLives: 1,
};
const enemyTypes: Record<string, EnemyType> = {
  a: { id: 'a', name: 'A', maxHp: 10, speed: 100, reward: 5, leakDamage: 1 },
};
const heroTypes: Record<string, HeroType> = {
  h: { id: 'h', name: 'H', cost: 50, range: 200, damage: 100, fireRate: 5 },
};

function makeConfig(): WorldConfig {
  return {
    level,
    enemyTypes,
    heroTypes,
    waves: [{ spawns: [{ enemyTypeId: 'a', count: 1, interval: 0.1 }] }],
  };
}

describe('World', () => {
  it('places a tower on a valid cell and charges gold', () => {
    const w = new World(makeConfig());
    expect(w.placeTower('h', 2, 2)).toBe(true);
    expect(w.gold).toBe(50);
    expect(w.towers.length).toBe(1);
  });

  it('rejects placement on the path, on an occupied footprint, or when broke', () => {
    const w = new World(makeConfig());
    expect(w.placeTower('h', 0, 0)).toBe(false); // footprint over the path
    expect(w.placeTower('h', 2, 2)).toBe(true); // gold 100 -> 50
    expect(w.placeTower('h', 2, 2)).toBe(false); // occupied
    expect(w.placeTower('h', 5, 2)).toBe(true); // gold 50 -> 0
    expect(w.placeTower('h', 8, 2)).toBe(false); // broke
  });

  it('lets a tower kill the spawned enemy and awards gold', () => {
    const w = new World(makeConfig());
    w.placeTower('h', 2, 2);
    expect(w.startNextWave()).toBe(true);
    // tick until the enemy spawns and is shot
    for (let i = 0; i < 5; i++) w.update(0.1);
    expect(w.enemies.length).toBe(0);
    expect(w.gold).toBe(55); // 100 - 50 cost + 5 reward
    expect(w.status).toBe('won');
  });

  it('emits a gold event when an enemy is killed', () => {
    const w = new World(makeConfig());
    w.placeTower('h', 2, 2);
    w.startNextWave();
    const amounts: number[] = [];
    for (let i = 0; i < 5; i++) {
      w.update(0.1);
      for (const g of w.events.gold) amounts.push(g.amount);
    }
    expect(amounts).toContain(5); // the killed enemy's reward
  });

  it('loses a life and the game when an enemy leaks', () => {
    const w = new World(makeConfig()); // no tower placed
    w.startNextWave();
    for (let i = 0; i < 20; i++) w.update(0.1); // enemy walks the 100px path
    expect(w.lives).toBe(0);
    expect(w.status).toBe('lost');
  });

  it('auto-starts the next wave after a short delay', () => {
    const w = new World(makeConfig());
    expect(w.waveNumber).toBe(0);
    expect(w.nextWaveIn).not.toBeNull();
    w.update(2.5); // before the delay elapses
    expect(w.waveNumber).toBe(0);
    w.update(1); // delay crossed -> auto-start
    expect(w.waveNumber).toBe(1);
  });
});
