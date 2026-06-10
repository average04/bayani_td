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

function makeWorld(heroTypes: Record<string, HeroType>): World {
  const cfg: WorldConfig = { level, enemyTypes: { plain }, heroTypes, waves: [] };
  return new World(cfg);
}

function addEnemy(w: World, x: number, y: number): Enemy {
  const e = new Enemy(plain, level.path);
  e.pos = { x, y };
  w.enemies.push(e);
  return e;
}

const auraHero = (id: string, damageAmp: number): HeroType => ({
  id, name: id, cost: 0, range: 100, damage: 8, fireRate: 0.0001, aura: { damageAmp },
});

describe('Inspiration aura (Rizal)', () => {
  it('the strongest nearby aura boosts a shooter; auras do not stack', () => {
    const shooter: HeroType = { id: 'shoot', name: 'S', cost: 0, range: 400, damage: 10, fireRate: 0.0001 };
    const w = makeWorld({ a: auraHero('a', 0.1), b: auraHero('b', 0.25), shoot: shooter });
    w.placeTower('a', 2, 2); // center (72,72)
    w.placeTower('shoot', 5, 2); // center (144,72): within 72px of both auras
    w.placeTower('b', 8, 2); // center (216,72)
    const e = addEnemy(w, 420, 0); // only the shooter can reach it
    w.update(0.016);
    expect(e.hp).toBeCloseTo(100 - 10 * 1.25, 5); // max(10%, 25%), not 35%
  });

  it('an aura hero does not boost himself', () => {
    const w = makeWorld({ a: auraHero('a', 0.5) });
    w.placeTower('a', 2, 2);
    const e = addEnemy(w, 100, 72); // 28px from him: in his own attack range
    w.update(0.016);
    expect(e.hp).toBe(92); // his own 8 damage, unboosted
  });
});

describe('roaming tower (Bonifacio)', () => {
  const roamer: HeroType = {
    id: 'roam', name: 'R', cost: 0, range: 50, damage: 5, fireRate: 0.0001, mobile: { speed: 100 },
  };

  it('chases the nearest enemy, then returns to his camp when the field clears', () => {
    const w = makeWorld({ roam: roamer });
    w.placeTower('roam', 2, 2); // anchor (72,72)
    const t = w.towers[0];
    addEnemy(w, 472, 72);
    w.update(1); // 100 px/s toward the enemy
    expect(t.pos.x).toBeCloseTo(172, 1);
    expect(t.pos.y).toBeCloseTo(72, 1);
    w.enemies.length = 0; // field cleared
    w.update(1);
    w.update(1);
    expect(t.pos.x).toBeCloseTo(74, 0); // walked back to the camp (stops within 2px)
  });

  it('selling a roamer frees his camp cells even after he wandered off', () => {
    const w = makeWorld({ roam: roamer });
    expect(w.placeTower('roam', 2, 2)).toBe(true);
    const t = w.towers[0];
    addEnemy(w, 472, 72);
    w.update(1); // he is far from the anchor now
    w.sellTower(t);
    expect(w.placeTower('roam', 2, 2)).toBe(true); // camp cells were freed
  });
});

describe('burning aura (Bonifacio trait)', () => {
  it('sears enemies inside the radius over time, ignoring those outside', () => {
    const fire: HeroType = {
      id: 'fire', name: 'F', cost: 0, range: 10, damage: 5, fireRate: 0.0001,
      burnAura: { radius: 60, dps: 10 },
    };
    const w = makeWorld({ fire });
    w.placeTower('fire', 2, 2); // center (72,72)
    const near = addEnemy(w, 112, 72); // 40px: inside the ring, outside attack range
    const far = addEnemy(w, 272, 72); // 200px: outside
    w.update(1);
    expect(near.hp).toBeCloseTo(90, 5);
    expect(far.hp).toBe(100);
  });
});
