import { describe, it, expect } from 'vitest';
import { selectTarget } from '../../../src/game/systems/targeting';
import { Tower } from '../../../src/game/entities/tower';
import { Enemy } from '../../../src/game/entities/enemy';
import type { HeroType } from '../../../src/game/config/heroes';
import type { EnemyType } from '../../../src/game/config/enemies';
import type { Vec2 } from '../../../src/game/geometry';

const hero: HeroType = { id: 'h', name: 'H', cost: 0, range: 100, damage: 10, fireRate: 1 };
const etype: EnemyType = { id: 'e', name: 'E', maxHp: 50, speed: 50, reward: 1, leakDamage: 1 };
const path: Vec2[] = [
  { x: 0, y: 0 },
  { x: 1000, y: 0 },
];

describe('selectTarget', () => {
  it('returns null when no enemy is in range', () => {
    const tower = new Tower(hero, { x: 0, y: 0 });
    const far = new Enemy(etype, path);
    far.pos = { x: 500, y: 0 };
    expect(selectTarget(tower, [far])).toBeNull();
  });

  it('chooses the enemy furthest along the path within range', () => {
    const tower = new Tower(hero, { x: 50, y: 0 });
    const behind = new Enemy(etype, path);
    behind.pos = { x: 20, y: 0 };
    const ahead = new Enemy(etype, path);
    ahead.pos = { x: 80, y: 0 };
    expect(selectTarget(tower, [behind, ahead])).toBe(ahead);
  });

  it('ignores dead and leaked enemies', () => {
    const tower = new Tower(hero, { x: 50, y: 0 });
    const dead = new Enemy(etype, path);
    dead.pos = { x: 60, y: 0 };
    dead.takeDamage(999);
    const leaked = new Enemy(etype, path);
    leaked.pos = { x: 40, y: 0 };
    leaked.reachedEnd = true;
    expect(selectTarget(tower, [dead, leaked])).toBeNull();
  });

  it('honors the tower target mode (first/last/strong/close)', () => {
    const tower = new Tower(hero, { x: 50, y: 0 });
    const a = new Enemy(etype, path); // behind, closer to tower, full hp
    a.pos = { x: 20, y: 0 };
    const b = new Enemy(etype, path); // ahead, farther, hurt
    b.pos = { x: 90, y: 0 };
    b.takeDamage(20); // hp 30 vs a's 50
    tower.targetMode = 'first';
    expect(selectTarget(tower, [a, b])).toBe(b); // furthest along
    tower.targetMode = 'last';
    expect(selectTarget(tower, [a, b])).toBe(a); // least far along
    tower.targetMode = 'strong';
    expect(selectTarget(tower, [a, b])).toBe(a); // highest hp
    tower.targetMode = 'close';
    expect(selectTarget(tower, [a, b])).toBe(a); // nearest the tower
  });
});
