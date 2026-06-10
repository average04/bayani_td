import { describe, it, expect } from 'vitest';
import { World } from '../../src/game/world';
import { WaveManager } from '../../src/game/systems/waveManager';
import type { LevelConfig } from '../../src/game/config/levels';
import type { EnemyType } from '../../src/game/config/enemies';

const level: LevelConfig = {
  id: 't', name: 'T', tileSize: 48, cols: 16, rows: 10, cellSize: 24,
  path: [{ x: 0, y: 0 }, { x: 700, y: 0 }],
  startingGold: 100, startingLives: 20,
};
// immortal, immobile grunts: they pile up on the field and never clear it
const grunt: EnemyType = { id: 'grunt', name: 'G', maxHp: 1e9, speed: 0, reward: 1, leakDamage: 1 };

// timed worlds read an injectable clock; tests drive it manually (ms)
function makeTimedWorld(now: () => number): World {
  return new World({
    level,
    enemyTypes: { grunt },
    heroTypes: {},
    waves: [
      { spawns: [{ enemyTypeId: 'grunt', count: 2, interval: 1 }] }, // spawn duration 2s
      { spawns: [{ enemyTypeId: 'grunt', count: 1, interval: 1 }] },
    ],
    generateWave: () => ({ spawns: [{ enemyTypeId: 'grunt', count: 1, interval: 1 }] }),
    timedWaves: { epochMs: 0, now },
  });
}

describe('timed waves (multiplayer)', () => {
  it('starts wave 1 on the match clock, not on player input', () => {
    let t = 0;
    const w = makeTimedWorld(() => t);
    t = 2900;
    w.update(0.05);
    expect(w.waveNumber).toBe(0); // not yet — first wave fires at +3s
    t = 3100;
    w.update(0.05);
    expect(w.waveNumber).toBe(1);
  });

  it('starts the next wave on schedule even with enemies still on the field', () => {
    let t = 3100;
    const w = makeTimedWorld(() => t);
    w.update(0.05); // wave 1 starts
    w.update(1.0); // spawn 1
    w.update(1.0); // spawn 2 — spawning done
    expect(w.enemies.length).toBe(2); // immortal: the field is NOT clear
    // schedule: wave 2 at 3s + spawnDuration(2s) + 8s gap = 13s
    t = 12900;
    w.update(0.05);
    expect(w.waveNumber).toBe(1);
    t = 13100;
    w.update(0.05);
    expect(w.waveNumber).toBe(2); // started despite the crowded field (solo would wait)
  });

  it('blocks manual wave starts — the shared clock is the only driver', () => {
    let t = 3100;
    const w = makeTimedWorld(() => t);
    w.update(0.05);
    expect(w.startNextWave()).toBe(false);
    expect(w.waveNumber).toBe(1);
  });

  it('pays the wave bonus when spawning completes, not when the field clears', () => {
    let t = 3100;
    const w = makeTimedWorld(() => t);
    w.update(0.05); // wave 1 starts (spawning)
    expect(w.gold).toBe(100);
    w.update(1.0);
    w.update(1.0); // spawning finished; enemies remain alive
    w.update(0.05);
    expect(w.gold).toBe(100 + 12); // no kills happened — just the wave bonus (10 + 2*wave)
  });

  it('exposes the time until the next scheduled wave', () => {
    let t = 0;
    const w = makeTimedWorld(() => t);
    w.update(0.05);
    expect(w.nextWaveIn).toBeCloseTo(3, 1);
    t = 2000;
    expect(w.nextWaveIn).toBeCloseTo(1, 1);
  });
});

describe('WaveManager.spawnDuration', () => {
  it('sums count * interval across sequential groups', () => {
    const wm = new WaveManager([
      { spawns: [{ enemyTypeId: 'a', count: 3, interval: 0.5 }, { enemyTypeId: 'b', count: 2, interval: 2 }] },
    ]);
    expect(wm.spawnDuration(1)).toBeCloseTo(3 * 0.5 + 2 * 2, 5);
  });
});
