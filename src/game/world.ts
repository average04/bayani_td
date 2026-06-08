import type { LevelConfig } from './config/levels';
import type { EnemyType } from './config/enemies';
import type { HeroType } from './config/heroes';
import type { WaveConfig } from './config/waves';
import type { Vec2 } from './geometry';
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

  constructor(cfg: WorldConfig) {
    this.level = cfg.level;
    this.enemyTypes = cfg.enemyTypes;
    this.heroTypes = cfg.heroTypes;
    this.economy = new Economy(cfg.level.startingGold);
    this.state = new GameState(cfg.level.startingLives);
    this.waveManager = new WaveManager(cfg.waves);
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

  placeTower(heroId: string, pos: Vec2): boolean {
    const hero = this.heroTypes[heroId];
    if (!hero) return false;
    const spot = this.level.buildSpots.find((s) => s.x === pos.x && s.y === pos.y);
    if (!spot) return false;
    if (this.towers.some((t) => t.pos.x === pos.x && t.pos.y === pos.y)) return false;
    if (!this.economy.spend(hero.cost)) return false;
    this.towers.push(new Tower(hero, { x: pos.x, y: pos.y }));
    return true;
  }

  update(dt: number): void {
    this.events.shots = [];
    this.events.deaths = [];
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
      if (t.canFire) {
        const target = selectTarget(t, this.enemies);
        if (target) {
          target.takeDamage(t.type.damage);
          t.resetCooldown();
          this.events.shots.push({
            from: { x: t.pos.x, y: t.pos.y },
            to: { x: target.pos.x, y: target.pos.y },
            heroId: t.type.id,
          });
        }
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
