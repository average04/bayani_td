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
  path: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
  ],
  buildSpots: [{ x: 50, y: 48 }],
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
  it('places a tower on a build spot and charges gold', () => {
    const w = new World(makeConfig());
    expect(w.placeTower('h', { x: 50, y: 48 })).toBe(true);
    expect(w.gold).toBe(50);
    expect(w.towers.length).toBe(1);
  });

  it('rejects tower placement off a build spot, on an occupied spot, or when broke', () => {
    const w = new World(makeConfig());
    expect(w.placeTower('h', { x: 999, y: 999 })).toBe(false);
    expect(w.placeTower('h', { x: 50, y: 48 })).toBe(true);
    expect(w.placeTower('h', { x: 50, y: 48 })).toBe(false); // occupied
    expect(w.placeTower('h', { x: 50, y: 48 })).toBe(false); // also broke now
  });

  it('lets a tower kill the spawned enemy and awards gold', () => {
    const w = new World(makeConfig());
    w.placeTower('h', { x: 50, y: 48 });
    expect(w.startNextWave()).toBe(true);
    // tick until the enemy spawns and is shot
    for (let i = 0; i < 5; i++) w.update(0.1);
    expect(w.enemies.length).toBe(0);
    expect(w.gold).toBe(55); // 100 - 50 cost + 5 reward
    expect(w.status).toBe('won');
  });

  it('loses a life and the game when an enemy leaks', () => {
    const w = new World(makeConfig()); // no tower placed
    w.startNextWave();
    for (let i = 0; i < 20; i++) w.update(0.1); // enemy walks the 100px path
    expect(w.lives).toBe(0);
    expect(w.status).toBe('lost');
  });
});
