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

describe('World events', () => {
  it('starts with empty event buffers', () => {
    const w = new World(makeConfig());
    expect(w.events.shots).toEqual([]);
    expect(w.events.deaths).toEqual([]);
  });

  it('records a shot (from tower to target) and a death when the enemy is killed', () => {
    const w = new World(makeConfig());
    w.placeTower('h', { x: 50, y: 48 });
    w.startNextWave();
    let sawShot = false;
    let sawDeath = false;
    for (let i = 0; i < 5; i++) {
      w.update(0.1);
      if (w.events.shots.length > 0) {
        sawShot = true;
        expect(w.events.shots[0].heroId).toBe('h');
        expect(w.events.shots[0].from).toEqual({ x: 50, y: 48 });
        expect(typeof w.events.shots[0].to.x).toBe('number');
        expect(w.events.shots[0].to.y).toBe(0);
      }
      if (w.events.deaths.length > 0) {
        sawDeath = true;
        expect(w.events.deaths[0].enemyTypeId).toBe('a');
      }
    }
    expect(sawShot).toBe(true);
    expect(sawDeath).toBe(true);
  });

  it('clears event buffers each tick while keeping the same array identity', () => {
    const w = new World(makeConfig());
    const shotsRef = w.events.shots;
    w.placeTower('h', { x: 50, y: 48 });
    w.startNextWave();
    // tick until a shot is recorded
    let recorded = false;
    for (let i = 0; i < 5 && !recorded; i++) {
      w.update(0.1);
      if (w.events.shots.length > 0) recorded = true;
    }
    expect(recorded).toBe(true);
    // a subsequent tick clears the buffer in place, preserving array identity
    w.update(0.1);
    expect(w.events.shots).toEqual([]);
    expect(w.events.shots).toBe(shotsRef);
  });
});
