import { describe, it, expect } from 'vitest';
import { World } from '../../src/game/world';
import type { WorldConfig } from '../../src/game/world';
import type { LevelConfig } from '../../src/game/config/levels';
import type { EnemyType } from '../../src/game/config/enemies';
import { scaledMaxHp } from '../../src/game/config/enemies';

const level: LevelConfig = {
  id: 't', name: 'T', tileSize: 48, cols: 16, rows: 10, cellSize: 24,
  path: [{ x: 0, y: 0 }, { x: 700, y: 0 }],
  startingGold: 1000, startingLives: 20,
};
const grunt: EnemyType = { id: 'grunt', name: 'G', maxHp: 50, speed: 0, reward: 2, leakDamage: 1 };

function makeWorld(): World {
  const cfg: WorldConfig = {
    level,
    enemyTypes: { grunt },
    heroTypes: {},
    waves: [{ spawns: [] }],
    generateWave: () => ({ spawns: [] }),
  };
  return new World(cfg);
}

describe('incoming sends', () => {
  it('spawns sent enemies staggered at the path entrance, flagged as sent', () => {
    const w = makeWorld();
    w.queueIncomingSend('grunt', 2);
    w.update(0.5); // first arrives (0.4s), second still pending (0.8s)
    expect(w.enemies).toHaveLength(1);
    w.update(0.4);
    expect(w.enemies).toHaveLength(2);
    expect(w.enemies.every((e) => e.sent)).toBe(true);
    expect(w.enemies[0].pos.x).toBeCloseTo(0, 0); // entered at path[0]
  });

  it('scales sent-enemy HP by the receiver wave (min wave 1)', () => {
    const w = makeWorld();
    w.queueIncomingSend('grunt', 1);
    w.update(0.5);
    expect(w.enemies[0].maxHp).toBe(scaledMaxHp(grunt.maxHp, 1)); // wave 0 clamps to 1
  });

  it('ignores unknown enemy ids', () => {
    const w = makeWorld();
    w.queueIncomingSend('nope', 3);
    w.update(1);
    expect(w.enemies).toHaveLength(0);
  });

  it('does not win a finite game while sends are still queued', () => {
    const w = new World({
      level,
      enemyTypes: { grunt },
      heroTypes: {},
      waves: [{ spawns: [] }], // single empty wave -> instantly clearable
    });
    w.startNextWave();
    w.queueIncomingSend('grunt', 1);
    w.update(0.1); // send still pending (arrives at 0.4s)
    expect(w.status).toBe('playing');
    w.update(0.4); // send materializes
    expect(w.enemies).toHaveLength(1);
    expect(w.status).toBe('playing');
  });
});
