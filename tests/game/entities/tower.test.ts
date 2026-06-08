import { describe, it, expect } from 'vitest';
import { Tower } from '../../../src/game/entities/tower';
import type { HeroType } from '../../../src/game/config/heroes';

const hero: HeroType = { id: 'h', name: 'H', cost: 100, range: 100, damage: 10, fireRate: 2 };

describe('Tower', () => {
  it('can fire immediately when created', () => {
    const t = new Tower(hero, { x: 0, y: 0 });
    expect(t.canFire).toBe(true);
  });

  it('cannot fire during cooldown and recovers after 1/fireRate seconds', () => {
    const t = new Tower(hero, { x: 0, y: 0 });
    t.resetCooldown(); // 1 / 2 = 0.5s
    expect(t.canFire).toBe(false);
    t.update(0.25);
    expect(t.canFire).toBe(false);
    t.update(0.25);
    expect(t.canFire).toBe(true);
  });

  it('reports whether a point is within range', () => {
    const t = new Tower(hero, { x: 0, y: 0 });
    expect(t.inRange({ x: 90, y: 0 })).toBe(true);
    expect(t.inRange({ x: 120, y: 0 })).toBe(false);
  });
});
