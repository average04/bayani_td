import { describe, it, expect } from 'vitest';
import {
  ENEMY_TYPES, slowResistFor, SLOW_RESIST_MAX,
} from '../../src/game/config/enemies';
import { Enemy } from '../../src/game/entities/enemy';
import type { EnemyType } from '../../src/game/config/enemies';

const path = [{ x: 0, y: 0 }, { x: 700, y: 0 }];

describe('deep-wave slow resistance', () => {
  it('ramps from 0% at wave 30 to 60% at wave 60, capped beyond', () => {
    expect(slowResistFor(ENEMY_TYPES.kapre, 1)).toBe(0);
    expect(slowResistFor(ENEMY_TYPES.kapre, 30)).toBe(0);
    expect(slowResistFor(ENEMY_TYPES.kapre, 45)).toBeCloseTo(0.3, 5);
    expect(slowResistFor(ENEMY_TYPES.kapre, 60)).toBeCloseTo(SLOW_RESIST_MAX, 5);
    expect(slowResistFor(ENEMY_TYPES.kapre, 90)).toBeCloseTo(SLOW_RESIST_MAX, 5);
  });

  it('veterans resist, the boss is fully immune, swarm types stay fully slowable', () => {
    expect(ENEMY_TYPES.kapre.resistsSlow).toBe(true);
    expect(ENEMY_TYPES.manananggal.resistsSlow).toBe(true);
    expect(ENEMY_TYPES.bakunawa.slowImmune).toBe(true); // 100% — nothing chills the moon-eater
    expect(slowResistFor(ENEMY_TYPES.aswang, 60)).toBe(0);
    expect(slowResistFor(ENEMY_TYPES.tiktik, 60)).toBe(0);
  });

  it('tiyanak carry a flat 80% resistance at every wave (no longer fully immune)', () => {
    expect(slowResistFor(ENEMY_TYPES.tiyanak, 1)).toBeCloseTo(0.8, 5);
    expect(slowResistFor(ENEMY_TYPES.tiyanak, 60)).toBeCloseTo(0.8, 5);
    const e = new Enemy(ENEMY_TYPES.tiyanak, path); // constructor applies the baseline
    e.applySlow(0.5, 2); // 50% chill lands as 10%: 1 - 0.5*0.2 = 0.9
    expect(e.slowFactor).toBeCloseTo(0.9, 5);
    expect(e.slowTimer).toBe(2);
  });

  it('the boss ignores slows outright', () => {
    const e = new Enemy(ENEMY_TYPES.bakunawa, path);
    e.applySlow(0.3, 3);
    expect(e.slowFactor).toBe(1);
    expect(e.slowTimer).toBe(0);
  });

  it('weakens applied slows proportionally', () => {
    const brute: EnemyType = { id: 'b', name: 'B', maxHp: 100, speed: 50, reward: 1, leakDamage: 1, resistsSlow: true };
    const e = new Enemy(brute, path);
    e.slowResist = 0.6;
    e.applySlow(0.5, 2); // a 50% slow only lands 20%: 1 - 0.5*0.4 = 0.8
    expect(e.slowFactor).toBeCloseTo(0.8, 5);

    const fresh = new Enemy(brute, path); // wave < 30: no resistance assigned
    fresh.applySlow(0.5, 2);
    expect(fresh.slowFactor).toBe(0.5);
  });
});
