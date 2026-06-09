import { describe, it, expect } from 'vitest';
import { World } from '../../src/game/world';
import type { WorldConfig } from '../../src/game/world';
import { Enemy } from '../../src/game/entities/enemy';
import type { LevelConfig } from '../../src/game/config/levels';
import type { EnemyType } from '../../src/game/config/enemies';
import type { HeroType } from '../../src/game/config/heroes';

const level: LevelConfig = {
  id: 'test',
  name: 'T',
  tileSize: 48,
  cols: 24,
  rows: 4,
  cellSize: 24,
  path: [
    { x: 0, y: 0 },
    { x: 1000, y: 0 },
  ],
  startingGold: 1000,
  startingLives: 50,
};
const plain: EnemyType = { id: 'plain', name: 'P', maxHp: 100, speed: 0, reward: 1, leakDamage: 1 };
const armored: EnemyType = { id: 'armored', name: 'A', maxHp: 100, speed: 0, reward: 1, leakDamage: 1, armor: 8 };

function world(hero: HeroType, enemyTypes: Record<string, EnemyType>): World {
  const cfg: WorldConfig = { level, enemyTypes, heroTypes: { [hero.id]: hero }, waves: [] };
  const w = new World(cfg);
  w.placeTower(hero.id, 2, 2);
  return w;
}

describe('World combat effects', () => {
  it('splash damages every enemy within the splash radius of the target', () => {
    const hero: HeroType = { id: 'splash', name: 'S', cost: 0, range: 300, damage: 10, fireRate: 0.0001, splashRadius: 60 };
    const w = world(hero, { plain });
    const e1 = new Enemy(plain, level.path);
    e1.pos = { x: 200, y: 0 };
    const e2 = new Enemy(plain, level.path);
    e2.pos = { x: 230, y: 0 };
    w.enemies.push(e1, e2);
    w.update(0.016);
    expect(e1.hp).toBe(90);
    expect(e2.hp).toBe(90);
  });

  it('a spin hero hits every enemy within range of itself, not around a target', () => {
    const hero: HeroType = { id: 'spinner', name: 'Sp', cost: 0, range: 80, damage: 30, fireRate: 0.0001, spin: true };
    const w = world(hero, { plain }); // tower placed at cell (2,2) -> center (72,72)
    const near = new Enemy(plain, level.path);
    near.pos = { x: 72, y: 120 }; // 48px away -> within range 80
    const near2 = new Enemy(plain, level.path);
    near2.pos = { x: 120, y: 72 }; // 48px away -> within range 80
    const far = new Enemy(plain, level.path);
    far.pos = { x: 300, y: 72 }; // 228px away -> out of range
    w.enemies.push(near, near2, far);
    w.update(0.016);
    expect(near.hp).toBe(70);
    expect(near2.hp).toBe(70);
    expect(far.hp).toBe(100);
  });

  it('a slow hero slows its target', () => {
    const hero: HeroType = { id: 'slower', name: 'Sl', cost: 0, range: 300, damage: 1, fireRate: 0.0001, slow: { factor: 0.5, duration: 2 } };
    const w = world(hero, { plain });
    const e = new Enemy(plain, level.path);
    e.pos = { x: 200, y: 0 };
    w.enemies.push(e);
    w.update(0.016);
    expect(e.slowFactor).toBe(0.5);
    expect(e.slowTimer).toBeGreaterThan(0);
  });

  it('a poison hero poisons its target', () => {
    const hero: HeroType = { id: 'poisoner', name: 'Po', cost: 0, range: 300, damage: 1, fireRate: 0.0001, poison: { dps: 8, duration: 3 } };
    const w = world(hero, { plain });
    const e = new Enemy(plain, level.path);
    e.pos = { x: 200, y: 0 };
    w.enemies.push(e);
    w.update(0.016);
    expect(e.poisonDps).toBe(8);
    expect(e.poisonTimer).toBeGreaterThan(0);
  });

  it('armor reduces direct damage', () => {
    const hero: HeroType = { id: 'direct', name: 'D', cost: 0, range: 300, damage: 10, fireRate: 0.0001 };
    const w = world(hero, { armored });
    const e = new Enemy(armored, level.path);
    e.pos = { x: 200, y: 0 };
    w.enemies.push(e);
    w.update(0.016);
    expect(e.hp).toBe(98);
  });

  it('poison ignores armor', () => {
    const hero: HeroType = { id: 'poisoner', name: 'Po', cost: 0, range: 300, damage: 10, fireRate: 0.0001, poison: { dps: 50, duration: 2 } };
    const w = world(hero, { armored });
    const e = new Enemy(armored, level.path);
    e.pos = { x: 200, y: 0 };
    w.enemies.push(e);
    w.update(1);
    expect(e.hp).toBe(98);
    w.update(1);
    expect(e.hp).toBe(48);
  });
});
