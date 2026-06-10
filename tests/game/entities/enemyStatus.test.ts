import { describe, it, expect } from 'vitest';
import { Enemy } from '../../../src/game/entities/enemy';
import type { EnemyType } from '../../../src/game/config/enemies';
import type { Vec2 } from '../../../src/game/geometry';

const path: Vec2[] = [
  { x: 0, y: 0 },
  { x: 1000, y: 0 },
];
function etype(over: Partial<EnemyType> = {}): EnemyType {
  return { id: 'e', name: 'E', maxHp: 100, speed: 100, reward: 1, leakDamage: 1, ...over };
}

describe('Enemy status effects', () => {
  it('armor reduces incoming damage but never below 1', () => {
    const e = new Enemy(etype({ armor: 8 }), path);
    e.takeDamage(20);
    expect(e.hp).toBe(88);
    e.takeDamage(3);
    expect(e.hp).toBe(87);
  });

  it('slow halves effective speed while active', () => {
    const e = new Enemy(etype({ speed: 100 }), path);
    e.applySlow(0.5, 10);
    e.update(1);
    expect(e.pos.x).toBeCloseTo(50);
  });

  it('slow-immune enemies ignore slows entirely', () => {
    const e = new Enemy(etype({ speed: 100, slowImmune: true }), path);
    e.applySlow(0.5, 10);
    e.update(1);
    expect(e.pos.x).toBeCloseTo(100); // full speed, unaffected
  });

  it('speed returns to normal after the slow expires', () => {
    const e = new Enemy(etype({ speed: 100 }), path);
    e.applySlow(0.5, 0.5);
    e.update(0.5);
    expect(e.pos.x).toBeCloseTo(25);
    e.update(1);
    expect(e.pos.x).toBeCloseTo(125);
  });

  it('poison deals damage over time and can kill', () => {
    const e = new Enemy(etype({ maxHp: 20 }), path);
    e.applyPoison(8, 3);
    e.update(1);
    expect(e.hp).toBeCloseTo(12);
    e.update(1);
    e.update(1);
    expect(e.isDead).toBe(true);
  });

  it('regen heals over time, capped at maxHp', () => {
    const e = new Enemy(etype({ maxHp: 100, regenPerSec: 6 }), path);
    e.takeDamage(50);
    e.update(1);
    expect(e.hp).toBeCloseTo(56);
    for (let i = 0; i < 100; i++) e.update(1);
    expect(e.hp).toBe(100);
  });

  it('poison out-damages regen for a net loss', () => {
    const e = new Enemy(etype({ maxHp: 100, regenPerSec: 6 }), path);
    e.applyPoison(8, 10);
    e.update(1);
    expect(e.hp).toBeCloseTo(98);
  });
});
