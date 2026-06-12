import { describe, it, expect } from 'vitest';
import { World } from '../../src/game/world';
import type { WorldConfig } from '../../src/game/world';
import { Enemy } from '../../src/game/entities/enemy';
import type { LevelConfig } from '../../src/game/config/levels';
import type { EnemyType } from '../../src/game/config/enemies';
import type { HeroType } from '../../src/game/config/heroes';
import { WAVES, generateWave } from '../../src/game/config/waves';

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

function world(hero: HeroType, enemyTypes: Record<string, EnemyType>, waves: WorldConfig['waves'] = []): World {
  const cfg: WorldConfig = { level, enemyTypes, heroTypes: { [hero.id]: hero }, waves };
  const w = new World(cfg);
  w.placeTower(hero.id, 2, 2);
  return w;
}

function addEnemy(w: World, type: EnemyType, x: number, y = 0): Enemy {
  const e = new Enemy(type, level.path);
  e.pos = { x, y };
  w.enemies.push(e);
  return e;
}

describe('rhythm traits (Rampage / Deadeye)', () => {
  it('multiplies damage on every Nth shot and flags it as a crit', () => {
    const hero: HeroType = {
      id: 'deadeye', name: 'D', cost: 0, range: 300, damage: 10, fireRate: 1000,
      rhythm: { every: 2, damageMult: 3 },
    };
    const w = world(hero, { plain });
    const e = addEnemy(w, plain, 200);
    w.update(0.016); // shot 1: normal
    expect(e.hp).toBe(90);
    expect(w.events.shots[0].crit).toBe(false);
    w.update(0.016); // shot 2: on the beat, 3x
    expect(e.hp).toBe(60);
    expect(w.events.shots[0].crit).toBe(true);
  });
});

describe('Aftershock (delayed echo)', () => {
  it('repeats the splash at a fraction of the damage after the delay', () => {
    const hero: HeroType = {
      id: 'shaker', name: 'B', cost: 0, range: 300, damage: 10, fireRate: 0.0001, splashRadius: 60,
      rhythm: { every: 1, echo: { delay: 0.1, frac: 0.5 } },
    };
    const w = world(hero, { plain });
    const e = addEnemy(w, plain, 200);
    w.update(0.016); // direct hit + echo queued
    expect(e.hp).toBe(90);
    expect(w.events.echoes).toHaveLength(0);
    w.update(0.2); // echo lands: 50% of 10 = 5
    expect(e.hp).toBe(85);
    expect(w.events.echoes).toHaveLength(1);
  });
});

describe('Fey Mark (slow + damage amp)', () => {
  it('amplifies damage taken while the slow lasts, then wears off', () => {
    const hero: HeroType = {
      id: 'fey', name: 'F', cost: 0, range: 300, damage: 10, fireRate: 0.0001,
      slow: { factor: 0.5, duration: 2 },
      mark: { amp: 0.5 },
    };
    const w = world(hero, { plain });
    const e = addEnemy(w, plain, 200);
    w.update(0.016); // hit (unamplified) + mark applied
    expect(e.hp).toBe(90);
    e.takeDamage(10); // marked: 10 * 1.5
    expect(e.hp).toBe(75);
    e.update(3); // mark expires
    e.takeDamage(10);
    expect(e.hp).toBeCloseTo(65, 5);
  });
});

describe('Contagion (poison spreads on death)', () => {
  it('passes the poison to the nearest enemies in radius when a poisoned enemy dies', () => {
    const hero: HeroType = {
      id: 'witch', name: 'M', cost: 0, range: 300, damage: 10, fireRate: 0.0001,
      poison: { dps: 8, duration: 3 },
      contagion: { radius: 70, maxTargets: 1, minDuration: 1.5 },
    };
    const w = world(hero, { plain });
    // 'first' targeting picks the enemy furthest along the path, so the dying one leads
    const dying = addEnemy(w, plain, 290);
    dying.hp = 5; // the direct hit kills it
    const near = addEnemy(w, plain, 260); // 30px away: in contagion radius
    const far = addEnemy(w, plain, 100); // out of radius
    w.update(0.016);
    expect(dying.isDead).toBe(true);
    expect(near.poisonDps).toBe(8);
    expect(near.poisonTimer).toBeGreaterThanOrEqual(1.5);
    expect(far.poisonDps).toBe(0);
  });
});

describe('Sunpierce (armor pierce + first strike)', () => {
  it('ignores armor and deals bonus damage while the target stays above 70% HP', () => {
    const hero: HeroType = {
      id: 'sun', name: 'S', cost: 0, range: 300, damage: 10, fireRate: 1000,
      pierce: true,
      firstStrike: 1.5,
    };
    const w = world(hero, { armored });
    const e = addEnemy(w, armored, 200);
    w.update(0.016); // 100 HP (>=70%): 10 * 1.5, no armor
    expect(e.hp).toBe(85);
    w.update(0.016); // 85 HP (>=70%): still boosted
    expect(e.hp).toBe(70);
    w.update(0.016); // 70 HP (boundary, >=70%): boosted one last time
    expect(e.hp).toBe(55);
    w.update(0.016); // 55 HP (<70%): plain 10, still no armor
    expect(e.hp).toBe(45);
  });
});

describe('boss waves', () => {
  it('authored wave 10 leads with the Bakunawa', () => {
    expect(WAVES[9].spawns[0].enemyTypeId).toBe('bakunawa');
  });
  it('every generated 10th wave includes Bakunawa, growing in number', () => {
    expect(generateWave(20).spawns[0]).toMatchObject({ enemyTypeId: 'bakunawa', count: 1 });
    expect(generateWave(30).spawns[0]).toMatchObject({ enemyTypeId: 'bakunawa', count: 1 });
    expect(generateWave(40).spawns[0]).toMatchObject({ enemyTypeId: 'bakunawa', count: 2 });
    expect(generateWave(70).spawns[0]).toMatchObject({ enemyTypeId: 'bakunawa', count: 3 });
    expect(generateWave(21).spawns.some((s) => s.enemyTypeId === 'bakunawa')).toBe(false);
  });
});

describe('wave-clear bonus', () => {
  it('pays base + per-wave gold once when the wave is fully cleared', () => {
    const hero: HeroType = { id: 'killer', name: 'K', cost: 0, range: 2000, damage: 1000, fireRate: 1000 };
    const w = world(hero, { plain }, [{ spawns: [{ enemyTypeId: 'plain', count: 1, interval: 0.01 }] }]);
    w.startNextWave();
    w.update(0.02); // spawn + one-shot kill + clear bonus, all this tick
    expect(w.gold).toBe(1000 + 1 + 12); // start + reward + (10 + 2*1)
    w.update(0.016); // no double pay
    expect(w.gold).toBe(1013);
  });
});
