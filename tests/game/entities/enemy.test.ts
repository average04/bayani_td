import { describe, it, expect } from 'vitest';
import { Enemy } from '../../../src/game/entities/enemy';
import type { EnemyType } from '../../../src/game/config/enemies';
import type { Vec2 } from '../../../src/game/geometry';

const type: EnemyType = { id: 't', name: 'T', maxHp: 50, speed: 100, reward: 5, leakDamage: 1 };
const path: Vec2[] = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
];

describe('Enemy', () => {
  it('starts at the first waypoint with full hp', () => {
    const e = new Enemy(type, path);
    expect(e.pos).toEqual({ x: 0, y: 0 });
    expect(e.hp).toBe(50);
    expect(e.reachedEnd).toBe(false);
  });

  it('moves toward the next waypoint by speed * dt', () => {
    const e = new Enemy(type, path);
    e.update(0.5); // 100 * 0.5 = 50px
    expect(e.pos.x).toBeCloseTo(50);
    expect(e.pos.y).toBeCloseTo(0);
  });

  it('marks reachedEnd when it passes the final waypoint', () => {
    const e = new Enemy(type, path);
    e.update(1.5); // travels 150px, overshooting the 100px path
    expect(e.reachedEnd).toBe(true);
  });

  it('dies when hp drops to zero', () => {
    const e = new Enemy(type, path);
    e.takeDamage(50);
    expect(e.isDead).toBe(true);
  });

  it('does not move while rooted, then resumes', () => {
    const e = new Enemy(type, path);
    e.applyRoot(1);
    e.update(0.5); // rooted: should not move
    expect(e.pos.x).toBeCloseTo(0);
    e.update(0.5); // root expires exactly here, still no travel this frame
    expect(e.pos.x).toBeCloseTo(0);
    e.update(0.5); // root gone: moves 100 * 0.5 = 50px
    expect(e.pos.x).toBeCloseTo(50);
  });
});
