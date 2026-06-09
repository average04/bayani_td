import type { LevelConfig } from './config/levels';
import type { EnemyType } from './config/enemies';
import type { HeroType } from './config/heroes';
import type { WaveConfig } from './config/waves';
import { distance, type Vec2 } from './geometry';
import { pathCells, canPlace, footprintCenter, footprintCells, cellKey } from './grid';
import { Enemy } from './entities/enemy';
import { Tower } from './entities/tower';
import { Store } from './entities/store';
import { STORE, nextStoreUpgrade } from './config/store';
import { Economy } from './systems/economy';
import { GameState, type GameStatus } from './state/gameState';
import { WaveManager } from './systems/waveManager';
import { selectTarget } from './systems/targeting';
import { canUpgradePath, nextUpgrade, type TowerStats } from './config/upgrades';

const AUTO_START_DELAY = 3; // seconds after a wave is cleared before the next auto-starts

export interface ShotEvent {
  from: Vec2;
  to: Vec2;
  heroId: string;
}

export interface DeathEvent {
  pos: Vec2;
  enemyTypeId: string;
}

export interface GoldEvent {
  pos: Vec2;
  amount: number;
}

export interface WorldEvents {
  shots: ShotEvent[];
  deaths: DeathEvent[];
  gold: GoldEvent[];
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
  stores: Store[] = [];
  readonly events: WorldEvents = { shots: [], deaths: [], gold: [] };
  private readonly blockedCells: Set<string>;
  private readonly occupiedCells = new Set<string>();
  private nextWaveTimer = 0;

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
  // seconds until the next wave auto-starts, or null when a wave is in progress / the game is over
  get nextWaveIn(): number | null {
    return this.canStartNextWave() ? Math.max(0, AUTO_START_DELAY - this.nextWaveTimer) : null;
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

  towerAt(x: number, y: number): Tower | null {
    const cs = this.level.cellSize;
    for (const t of this.towers) {
      if (Math.abs(x - t.pos.x) <= cs && Math.abs(y - t.pos.y) <= cs) return t;
    }
    return null;
  }

  canUpgrade(tower: Tower, path: number): boolean {
    return nextUpgrade(tower.type, tower.levels, path) !== null && canUpgradePath(tower.levels, path);
  }

  nextUpgradeCost(tower: Tower, path: number): number | null {
    const u = nextUpgrade(tower.type, tower.levels, path);
    return u ? u.cost : null;
  }

  upgradeTower(tower: Tower, path: number): boolean {
    const u = nextUpgrade(tower.type, tower.levels, path);
    if (!u || !canUpgradePath(tower.levels, path)) return false;
    if (!this.economy.spend(u.cost)) return false;
    tower.upgrade(path);
    tower.spent += u.cost;
    return true;
  }

  sellValue(tower: Tower): number {
    return Math.floor(tower.spent * 0.7);
  }

  sellTower(tower: Tower): number {
    const idx = this.towers.indexOf(tower);
    if (idx < 0) return 0;
    const refund = this.sellValue(tower);
    this.economy.earn(refund);
    this.towers.splice(idx, 1);
    const cs = this.level.cellSize;
    const col = Math.round(tower.pos.x / cs) - 1;
    const row = Math.round(tower.pos.y / cs) - 1;
    for (const c of footprintCells(col, row)) this.occupiedCells.delete(cellKey(c.col, c.row));
    return refund;
  }

  canPlaceStoreAt(col: number, row: number): boolean {
    return canPlace(this.level, this.blockedCells, this.occupiedCells, col, row, STORE.width, STORE.height);
  }

  placeStore(col: number, row: number): boolean {
    if (!this.canPlaceStoreAt(col, row)) return false;
    if (!this.economy.spend(STORE.cost)) return false;
    const pos = footprintCenter(this.level, col, row, STORE.width, STORE.height);
    this.stores.push(new Store(pos, col, row));
    for (const c of footprintCells(col, row, STORE.width, STORE.height)) this.occupiedCells.add(cellKey(c.col, c.row));
    return true;
  }

  storeAt(x: number, y: number): Store | null {
    const cs = this.level.cellSize;
    const hw = (STORE.width * cs) / 2;
    const hh = (STORE.height * cs) / 2;
    for (const st of this.stores) {
      if (Math.abs(x - st.pos.x) <= hw && Math.abs(y - st.pos.y) <= hh) return st;
    }
    return null;
  }

  sellStore(store: Store): number {
    const idx = this.stores.indexOf(store);
    if (idx < 0) return 0;
    const refund = Math.floor(store.spent * STORE.sellRefund);
    this.economy.earn(refund);
    this.stores.splice(idx, 1);
    for (const c of footprintCells(store.col, store.row, STORE.width, STORE.height)) {
      this.occupiedCells.delete(cellKey(c.col, c.row));
    }
    return refund;
  }

  canUpgradeStore(store: Store, path: number): boolean {
    return nextStoreUpgrade(store.levels, path) !== null && canUpgradePath(store.levels, path);
  }

  nextStoreUpgradeCost(store: Store, path: number): number | null {
    const u = nextStoreUpgrade(store.levels, path);
    return u ? u.cost : null;
  }

  upgradeStore(store: Store, path: number): boolean {
    const u = nextStoreUpgrade(store.levels, path);
    if (!u || !canUpgradePath(store.levels, path)) return false;
    if (!this.economy.spend(u.cost)) return false;
    store.upgrade(path);
    store.spent += u.cost;
    return true;
  }

  private applyHit(affected: Enemy[], stats: TowerStats): void {
    for (const e of affected) {
      e.takeDamage(stats.damage);
      if (stats.slow) e.applySlow(stats.slow.factor, stats.slow.duration);
      if (stats.poison) e.applyPoison(stats.poison.dps, stats.poison.duration);
    }
  }

  update(dt: number): void {
    this.events.shots.length = 0;
    this.events.deaths.length = 0;
    this.events.gold.length = 0;
    if (this.state.status !== 'playing') return;

    // 1. spawn
    for (const id of this.waveManager.update(dt)) {
      const type = this.enemyTypes[id];
      if (type) this.enemies.push(new Enemy(type, this.level.path));
    }

    // 2. move enemies
    for (const e of this.enemies) e.update(dt);

    // 3. towers fire (reads effective, upgraded stats)
    for (const t of this.towers) {
      t.update(dt);
      if (!t.canFire) continue;
      const s = t.stats;
      if (s.spin) {
        const affected = this.enemies.filter(
          (e) => !e.isDead && !e.reachedEnd && distance(e.pos, t.pos) <= s.range,
        );
        if (affected.length === 0) continue;
        this.applyHit(affected, s);
        t.resetCooldown();
        this.events.shots.push({
          from: { x: t.pos.x, y: t.pos.y },
          to: { x: t.pos.x, y: t.pos.y }, // self-centered: from === to marks a spin
          heroId: t.type.id,
        });
      } else {
        const target = selectTarget(t, this.enemies);
        if (!target) continue;
        const affected = s.splashRadius
          ? this.enemies.filter(
              (e) => !e.isDead && !e.reachedEnd && distance(e.pos, target.pos) <= s.splashRadius!,
            )
          : [target];
        this.applyHit(affected, s);
        t.resetCooldown();
        this.events.shots.push({
          from: { x: t.pos.x, y: t.pos.y },
          to: { x: target.pos.x, y: target.pos.y },
          heroId: t.type.id,
        });
      }
    }

    // 3.5 stores generate passive income
    for (const st of this.stores) {
      const inc = st.tick(dt);
      if (inc) {
        this.economy.earn(inc);
        this.events.gold.push({ pos: { x: st.pos.x, y: st.pos.y }, amount: inc });
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
        this.events.gold.push({ pos: { x: e.pos.x, y: e.pos.y }, amount: e.type.reward });
      } else {
        survivors.push(e);
      }
    }
    this.enemies = survivors;

    // auto-start the next wave after a short delay once the current one is cleared
    if (this.canStartNextWave()) {
      this.nextWaveTimer += dt;
      if (this.nextWaveTimer >= AUTO_START_DELAY) {
        this.startNextWave();
        this.nextWaveTimer = 0;
      }
    } else {
      this.nextWaveTimer = 0;
    }

    // 5. win when the last wave is fully cleared
    if (this.state.status === 'playing' && this.waveManager.isComplete && this.enemies.length === 0) {
      this.state.win();
    }
  }
}
