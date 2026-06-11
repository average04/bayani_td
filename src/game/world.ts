import type { LevelConfig } from './config/levels';
import { scaledMaxHp, slowResistFor, type EnemyType } from './config/enemies';
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
import { selectTarget, isFurtherAlong } from './systems/targeting';
import { canUpgradePath, nextUpgrade, type TowerStats } from './config/upgrades';
import { canSend, type SendOption } from './config/sends';

const AUTO_START_DELAY = 3; // seconds after a wave is cleared before the next auto-starts
// Multiplayer timed waves: pause between one wave's last spawn and the next wave's start.
// Waves NEVER wait for the field to clear, so both players' schedules stay in lockstep.
const MP_WAVE_GAP = 8;
const MP_FIRST_WAVE_AT = 3; // seconds after the match clock starts
// Gold awarded when a wave is fully cleared: base + per-wave. Keeps the deep-wave economy
// alive now that per-kill bounties are intentionally small.
const WAVE_BONUS_BASE = 10;
const WAVE_BONUS_PER_WAVE = 2;

export interface ShotEvent {
  from: Vec2;
  to: Vec2;
  heroId: string;
  crit?: boolean; // a rhythm-trait power shot (Rampage/Deadeye) — FX sell it bigger
}

export interface DeathEvent {
  pos: Vec2;
  enemyTypeId: string;
}

export interface GoldEvent {
  pos: Vec2;
  amount: number;
}

export interface EchoEvent {
  pos: Vec2;
  radius: number;
}

export interface WorldEvents {
  shots: ShotEvent[];
  deaths: DeathEvent[];
  gold: GoldEvent[];
  echoes: EchoEvent[]; // Aftershock ground-quakes resolving
}

// A delayed area hit (Bernardo's Aftershock): lands at pos after timer reaches 0.
interface PendingEcho {
  timer: number;
  pos: Vec2;
  radius: number;
  damage: number;
}

export interface WorldConfig {
  level: LevelConfig;
  enemyTypes: Record<string, EnemyType>;
  heroTypes: Record<string, HeroType>;
  waves: WaveConfig[];
  generateWave?: (waveNumber: number) => WaveConfig; // endless mode when provided
  // multiplayer: waves start on a wall-clock schedule anchored at epochMs (shared by both
  // players), regardless of whether the field is clear. `now` is injectable for tests.
  timedWaves?: { epochMs: number; now?: () => number };
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
  readonly events: WorldEvents = { shots: [], deaths: [], gold: [], echoes: [] };
  private readonly blockedCells: Set<string>;
  private readonly occupiedCells = new Set<string>();
  private nextWaveTimer = 0;
  private pendingEchoes: PendingEcho[] = [];
  private incomingSends: { enemyTypeId: string; timer: number }[] = [];
  private lastBonusWave = 0; // last wave number whose clear bonus has been paid
  private readonly timedWaves?: { epochMs: number; now: () => number };
  private nextTimedStartS = MP_FIRST_WAVE_AT; // match-clock second the next wave starts at

  constructor(cfg: WorldConfig) {
    this.level = cfg.level;
    this.enemyTypes = cfg.enemyTypes;
    this.heroTypes = cfg.heroTypes;
    this.economy = new Economy(cfg.level.startingGold);
    this.state = new GameState(cfg.level.startingLives);
    this.waveManager = new WaveManager(cfg.waves, cfg.generateWave);
    this.blockedCells = pathCells(cfg.level);
    if (cfg.timedWaves) {
      this.timedWaves = { epochMs: cfg.timedWaves.epochMs, now: cfg.timedWaves.now ?? Date.now };
    }
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
    if (this.timedWaves) {
      if (this.state.status !== 'playing' || this.waveManager.isSpawning) return null;
      const elapsed = (this.timedWaves.now() - this.timedWaves.epochMs) / 1000;
      return Math.max(0, this.nextTimedStartS - elapsed);
    }
    return this.canStartNextWave() ? Math.max(0, AUTO_START_DELAY - this.nextWaveTimer) : null;
  }
  // total gold/sec the stores generate (per-second passive drip + averaged tick payouts)
  get passiveIncome(): number {
    let g = 0;
    for (const s of this.stores) g += s.income.passivePerSec + s.income.tickAmount / s.income.tickInterval;
    return g;
  }
  // a boss is on the field (drives the boss banner + UI emphasis)
  get bossActive(): boolean {
    return this.enemies.some((e) => e.type.boss);
  }

  canStartNextWave(): boolean {
    return (
      this.state.status === 'playing' &&
      this.enemies.length === 0 &&
      this.waveManager.canStartNextWave()
    );
  }

  startNextWave(): boolean {
    if (this.timedWaves) return false; // multiplayer waves run on the shared clock only
    if (!this.canStartNextWave()) return false;
    this.waveManager.startNextWave();
    return true;
  }

  /**
   * Multiplayer: opponent sent extra monsters. They enter staggered, scaled to OUR wave.
   * Each call's stagger starts from 0.4s, so overlapping calls arrive interleaved (by design).
   * Unknown enemy ids (a bad network message) drop the whole send.
   */
  queueIncomingSend(enemyTypeId: string, count: number): void {
    if (!this.enemyTypes[enemyTypeId]) return;
    for (let i = 0; i < count; i++) {
      this.incomingSends.push({ enemyTypeId, timer: 0.4 * (i + 1) });
    }
  }

  /** Multiplayer: validate + pay for an outgoing send. The caller emits the network event. */
  buySend(option: SendOption): boolean {
    if (!canSend(option, this.gold, this.waveNumber)) return false;
    return this.economy.spend(option.cost);
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
    // free the cells at the camp/anchor — a roaming tower's pos may be anywhere on the map
    const cs = this.level.cellSize;
    const col = Math.round(tower.anchor.x / cs) - 1;
    const row = Math.round(tower.anchor.y / cs) - 1;
    for (const c of footprintCells(col, row)) this.occupiedCells.delete(cellKey(c.col, c.row));
    return refund;
  }

  // stores are capped per game (selling one frees the slot)
  canBuildStore(): boolean {
    return this.stores.length < STORE.maxCount;
  }

  get storeMaxed(): boolean {
    return !this.canBuildStore();
  }

  canPlaceStoreAt(col: number, row: number): boolean {
    return canPlace(this.level, this.blockedCells, this.occupiedCells, col, row, STORE.width, STORE.height);
  }

  placeStore(col: number, row: number): boolean {
    if (!this.canBuildStore()) return false;
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

  private applyHit(affected: Enemy[], stats: TowerStats, damage: number): void {
    for (const e of affected) {
      let dmg = damage;
      // Sunpierce: bonus vs near-full-HP targets
      if (stats.firstStrike && e.hp >= e.maxHp * 0.9) dmg *= stats.firstStrike;
      e.takeDamage(dmg, stats.pierce);
      if (stats.slow) {
        e.applySlow(stats.slow.factor, stats.slow.duration);
        // Fey Mark rides on the slow: amplified damage for as long as the chill lasts
        if (stats.mark) e.applyMark(1 + stats.mark.amp, stats.slow.duration);
      }
      if (stats.poison) {
        e.applyPoison(stats.poison.dps, stats.poison.duration, stats.contagion ?? null, stats.poison.hpFracPerSec ?? 0);
      }
      if (stats.root && Math.random() < stats.root.chance) e.applyRoot(stats.root.duration);
    }
  }

  // Inspiration: the strongest aura from OTHER towers whose range covers this tower.
  private auraBoostFor(tower: Tower): number {
    let best = 0;
    for (const a of this.towers) {
      if (a === tower) continue;
      const amp = a.stats.aura?.damageAmp ?? 0;
      if (amp > best && distance(a.pos, tower.pos) <= a.stats.range) best = amp;
    }
    return best;
  }

  // Resolve one tower firing: rhythm traits decide the damage of THIS shot and whether an
  // aftershock echo gets queued. Returns whether the shot was a power shot (for FX).
  private fireAt(tower: Tower, affected: Enemy[], epicenter: Vec2): boolean {
    const s = tower.stats;
    const boost = 1 + this.auraBoostFor(tower);
    const shotNo = tower.registerShot();
    const onBeat = s.rhythm !== undefined && shotNo % s.rhythm.every === 0;
    let damage = s.damage * boost;
    if (onBeat && s.rhythm!.damageMult) damage *= s.rhythm!.damageMult;
    this.applyHit(affected, s, damage);
    if (onBeat && s.rhythm!.echo) {
      const echo = s.rhythm!.echo;
      this.pendingEchoes.push({
        timer: echo.delay,
        pos: { x: epicenter.x, y: epicenter.y },
        radius: s.splashRadius ?? 50,
        damage: s.damage * boost * echo.frac,
      });
    }
    tower.resetCooldown();
    return onBeat;
  }

  // Contagion: a dying poisoned enemy passes its poison to the nearest enemies in range.
  private spreadContagion(dead: Enemy): void {
    if (!dead.contagion || dead.poisonTimer <= 0 || dead.poisonDps <= 0) return;
    const c = dead.contagion;
    const candidates = this.enemies
      .filter((e) => e !== dead && !e.isDead && !e.reachedEnd && distance(e.pos, dead.pos) <= c.radius)
      .sort((a, b) => distance(a.pos, dead.pos) - distance(b.pos, dead.pos))
      .slice(0, c.maxTargets);
    const duration = Math.max(dead.poisonTimer, c.minDuration);
    for (const e of candidates) e.applyPoison(dead.poisonDps, duration, c);
  }

  update(dt: number): void {
    this.events.shots.length = 0;
    this.events.deaths.length = 0;
    this.events.gold.length = 0;
    this.events.echoes.length = 0;
    if (this.state.status !== 'playing') return;

    // 1. spawn
    for (const id of this.waveManager.update(dt)) {
      const type = this.enemyTypes[id];
      if (type) {
        const e = new Enemy(type, this.level.path, scaledMaxHp(type.maxHp, this.waveNumber));
        e.slowResist = slowResistFor(type, this.waveNumber);
        this.enemies.push(e);
      }
    }

    // 1.5 sent monsters arrive (multiplayer)
    if (this.incomingSends.length > 0) {
      const still: { enemyTypeId: string; timer: number }[] = [];
      for (const s of this.incomingSends) {
        s.timer -= dt;
        if (s.timer > 0) {
          still.push(s);
          continue;
        }
        const type = this.enemyTypes[s.enemyTypeId];
        const e = new Enemy(type, this.level.path, scaledMaxHp(type.maxHp, Math.max(1, this.waveNumber)));
        e.sent = true;
        e.slowResist = slowResistFor(type, Math.max(1, this.waveNumber));
        this.enemies.push(e);
      }
      this.incomingSends = still;
    }

    // 2. move enemies
    for (const e of this.enemies) e.update(dt);

    // 2.5 roaming towers intercept the FRONT-MOST enemy (or walk back to camp when clear)
    for (const t of this.towers) {
      const mob = t.type.mobile;
      if (!mob) continue;
      let target: Enemy | null = null;
      for (const e of this.enemies) {
        if (e.isDead || e.reachedEnd) continue;
        if (!target || isFurtherAlong(e, target)) target = e;
      }
      const dest = target ? target.pos : t.anchor;
      const stop = target ? t.stats.range * 0.5 : 2; // close in, but don't stand on top of them
      const dx = dest.x - t.pos.x;
      const dy = dest.y - t.pos.y;
      const d = Math.hypot(dx, dy);
      if (d > stop) {
        const step = Math.min(mob.speed * dt, d - stop);
        t.pos.x += (dx / d) * step;
        t.pos.y += (dy / d) * step;
      }
    }

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
        const crit = this.fireAt(t, affected, t.pos);
        this.events.shots.push({
          from: { x: t.pos.x, y: t.pos.y },
          to: { x: t.pos.x, y: t.pos.y }, // self-centered: from === to marks a spin
          heroId: t.type.id,
          crit,
        });
      } else {
        const target = selectTarget(t, this.enemies);
        if (!target) continue;
        const affected = s.splashRadius
          ? this.enemies.filter(
              (e) => !e.isDead && !e.reachedEnd && distance(e.pos, target.pos) <= s.splashRadius!,
            )
          : [target];
        const crit = this.fireAt(t, affected, target.pos);
        this.events.shots.push({
          from: { x: t.pos.x, y: t.pos.y },
          to: { x: target.pos.x, y: target.pos.y },
          heroId: t.type.id,
          crit,
        });
      }
    }

    // 3.2 aftershock echoes land (plain area damage, no statuses)
    if (this.pendingEchoes.length > 0) {
      const still: PendingEcho[] = [];
      for (const echo of this.pendingEchoes) {
        echo.timer -= dt;
        if (echo.timer > 0) {
          still.push(echo);
          continue;
        }
        for (const e of this.enemies) {
          if (!e.isDead && !e.reachedEnd && distance(e.pos, echo.pos) <= echo.radius) {
            e.takeDamage(echo.damage);
          }
        }
        this.events.echoes.push({ pos: echo.pos, radius: echo.radius });
      }
      this.pendingEchoes = still;
    }

    // 3.4 burning auras sear everything close (true damage, like poison; the HP-based
    // component scales with each victim, so big late-game bodies still feel the fire)
    for (const t of this.towers) {
      const burn = t.stats.burnAura;
      if (!burn) continue;
      for (const e of this.enemies) {
        if (!e.isDead && !e.reachedEnd && distance(e.pos, t.pos) <= burn.radius) {
          e.hp -= (burn.dps + (burn.hpFracPerSec ?? 0) * e.maxHp) * dt;
        }
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

    // 4. resolve leaks (lose life) and deaths (reward + contagion)
    const survivors: Enemy[] = [];
    for (const e of this.enemies) {
      if (e.reachedEnd) {
        this.state.loseLife(e.type.leakDamage);
      } else if (e.isDead) {
        this.economy.earn(e.type.reward);
        this.events.deaths.push({ pos: { x: e.pos.x, y: e.pos.y }, enemyTypeId: e.type.id });
        this.events.gold.push({ pos: { x: e.pos.x, y: e.pos.y }, amount: e.type.reward });
        this.spreadContagion(e);
      } else {
        survivors.push(e);
      }
    }
    this.enemies = survivors;

    // wave-clear bonus, paid once per cleared wave (all spawned, none left on the field).
    // Queued multiplayer sends intentionally do NOT delay this (or the auto-start below):
    // sends are additive pressure, not part of the wave.
    // Timed (multiplayer) mode pays when the wave finishes SPAWNING — waves overlap there,
    // so "field fully clear" would almost never trigger.
    const wave = this.waveManager.currentWaveNumber;
    const waveDone = this.timedWaves ? !this.waveManager.isSpawning : this.enemies.length === 0 && !this.waveManager.isSpawning;
    if (wave > this.lastBonusWave && waveDone && this.state.status === 'playing') {
      this.lastBonusWave = wave;
      const bonus = WAVE_BONUS_BASE + WAVE_BONUS_PER_WAVE * wave;
      this.economy.earn(bonus);
      const base = this.level.path[this.level.path.length - 1];
      this.events.gold.push({ pos: { x: base.x, y: base.y }, amount: bonus });
    }

    if (this.timedWaves) {
      // multiplayer: waves start on the shared match clock, clear or not — both boards stay in step
      const elapsed = (this.timedWaves.now() - this.timedWaves.epochMs) / 1000;
      while (
        elapsed >= this.nextTimedStartS &&
        this.waveManager.hasMoreWaves &&
        !this.waveManager.isSpawning
      ) {
        this.waveManager.startNextWave();
        this.nextTimedStartS += this.waveManager.spawnDuration(this.waveNumber) + MP_WAVE_GAP;
      }
    } else if (this.canStartNextWave()) {
      // solo: auto-start a short delay after the field is cleared
      this.nextWaveTimer += dt;
      if (this.nextWaveTimer >= AUTO_START_DELAY) {
        this.waveManager.startNextWave();
        this.nextWaveTimer = 0;
      }
    } else {
      this.nextWaveTimer = 0;
    }

    // 5. win when the last wave is fully cleared (queued sends still count as a threat)
    if (
      this.state.status === 'playing' &&
      this.waveManager.isComplete &&
      this.enemies.length === 0 &&
      this.incomingSends.length === 0
    ) {
      this.state.win();
    }
  }
}
