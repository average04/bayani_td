import type { LevelConfig } from './config/levels';
import type { EnemyType } from './config/enemies';
import type { HeroType } from './config/heroes';
import type { WaveConfig } from './config/waves';
import { distance, type Vec2 } from './geometry';
import { pathCells, canPlace, footprintCenter, footprintCells, cellKey } from './grid';
import { Enemy } from './entities/enemy';
import { Tower } from './entities/tower';
import { Economy } from './systems/economy';
import { GameState, type GameStatus } from './state/gameState';
import { WaveManager } from './systems/waveManager';
import { selectTarget } from './systems/targeting';

export interface ShotEvent {
  from: Vec2;
  to: Vec2;
  heroId: string;
}

export interface DeathEvent {
  pos: Vec2;
  enemyTypeId: string;
}

export interface WorldEvents {
  shots: ShotEvent[];
  deaths: DeathEvent[];
}

export interface WorldConfig {
  level: LevelConfig;
  enemyTypes: Record<string, EnemyType>;
  heroTypes: Record<string, HeroType>;
  waves: WaveConfig[];
}

export class World {
  readonly level: LevelConfig;
  private readonly enemyTypes: Record<string, EnemyType>;
  private readonly heroTypes: Record<string, HeroType>;
  readonly economy: Economy;
  readonly state: GameState;
  readonly waveManager: WaveManager;
  enemies: Enemy[] = [];
  towers: Tower[] = [];
  readonly events: WorldEvents = { shots: [], deaths: [] };
  private readonly blockedCells: Set<string>;
  private readonly occupiedCells = new Set<string>();

  constructor(cfg: WorldConfig) {
    this.level = cfg.level;
    this.enemyTypes = cfg.enemyTypes;
    this.heroTypes = cfg.heroTypes;
    this.economy = new Economy(cfg.level.startingGold);
    this.state = new GameState(cfg.level.startingLives);
    this.waveManager = new WaveManager(cfg.waves);
    this.blockedCells = pathCells(cfg.level);
  }

  get gold(): number {
    return this.economy.gold;
  }
  get lives(): number {
    return this.state.lives;
  }
  get status(): GameStatus {
    return this.state.status;
  }
  get waveNumber(): number {
    return this.waveManager.currentWaveNumber;
  }
  get totalWaves(): number {
    return this.waveManager.totalWaves;
  }

  canStartNextWave(): boolean {
    return (
      this.state.status === 'playing' &&
      this.enemies.length === 0 &&
      this.waveManager.canStartNextWave()
    );
  }

  startNextWave(): boolean {
    if (!this.canStartNextWave()) return false;
    this.waveManager.startNextWave();
    return true;
  }

  canPlaceAt(col: number, row: number): boolean {
    return canPlace(this.level, this.blockedCells, this.occupiedCells, col, row);
  }

  placeTower(heroId: string, col: number, row: number): boolean {
    const hero = this.heroTypes[heroId];
    if (!hero) return false;
    if (!this.canPlaceAt(col, row)) return false;
    if (!this.economy.spend(hero.cost)) return false;
    this.towers.push(new Tower(hero, footprintCenter(this.level, col, row)));
    for (const cell of footprintCells(col, row)) this.occupiedCells.add(cellKey(cell.col, cell.row));
    return true;
  }

  private applyHit(affected: Enemy[], hero: HeroType): void {
    for (const e of affected) {
      e.takeDamage(hero.damage);
      if (hero.slow) e.applySlow(hero.slow.factor, hero.slow.duration);
      if (hero.poison) e.applyPoison(hero.poison.dps, hero.poison.duration);
    }
  }

  update(dt: number): void {
    this.events.shots.length = 0;
    this.events.deaths.length = 0;
    if (this.state.status !== 'playing') return;

    // 1. spawn
    for (const id of this.waveManager.update(dt)) {
      const type = this.enemyTypes[id];
      if (type) this.enemies.push(new Enemy(type, this.level.path));
    }

    // 2. move enemies
    for (const e of this.enemies) e.update(dt);

    // 3. towers fire
    for (const t of this.towers) {
      t.update(dt);
      if (!t.canFire) continue;
      const hero = t.type;
      if (hero.spin) {
        // melee spin: every swing hits all enemies within range of the hero itself
        const affected = this.enemies.filter(
          (e) => !e.isDead && !e.reachedEnd && distance(e.pos, t.pos) <= hero.range,
        );
        if (affected.length === 0) continue;
        this.applyHit(affected, hero);
        t.resetCooldown();
        this.events.shots.push({
          from: { x: t.pos.x, y: t.pos.y },
          to: { x: t.pos.x, y: t.pos.y }, // self-centered: from === to marks a spin
          heroId: hero.id,
        });
      } else {
        const target = selectTarget(t, this.enemies);
        if (!target) continue;
        const affected = hero.splashRadius
          ? this.enemies.filter(
              (e) => !e.isDead && !e.reachedEnd && distance(e.pos, target.pos) <= hero.splashRadius!,
            )
          : [target];
        this.applyHit(affected, hero);
        t.resetCooldown();
        this.events.shots.push({
          from: { x: t.pos.x, y: t.pos.y },
          to: { x: target.pos.x, y: target.pos.y },
          heroId: hero.id,
        });
      }
    }

    // 4. resolve leaks (lose life) and deaths (reward)
    const survivors: Enemy[] = [];
    for (const e of this.enemies) {
      if (e.reachedEnd) {
        this.state.loseLife(e.type.leakDamage);
      } else if (e.isDead) {
        this.economy.earn(e.type.reward);
        this.events.deaths.push({ pos: { x: e.pos.x, y: e.pos.y }, enemyTypeId: e.type.id });
      } else {
        survivors.push(e);
      }
    }
    this.enemies = survivors;

    // 5. win when the last wave is fully cleared
    if (this.state.status === 'playing' && this.waveManager.isComplete && this.enemies.length === 0) {
      this.state.win();
    }
  }
}
