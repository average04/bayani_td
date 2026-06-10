import Phaser from 'phaser';
import { World } from '../game/world';
import { LEVEL_ONE } from '../game/config/levels';
import { ENEMY_TYPES } from '../game/config/enemies';
import { HERO_TYPES } from '../game/config/heroes';
import { getLoadout } from '../game/config/loadout';
import { STORE } from '../game/config/store';
import { WAVES, generateWave } from '../game/config/waves';
import { loadSave, saveBestWave } from '../services/localSave';
import { footprintTopLeftAt } from '../game/grid';
import type { Enemy } from '../game/entities/enemy';
import type { Tower } from '../game/entities/tower';
import type { Store } from '../game/entities/store';
import { renderMap } from '../render/mapRenderer';
import { EnemyView } from '../render/enemyView';
import { TowerView } from '../render/towerView';
import { StoreView } from '../render/storeView';
import {
  spawnProjectile,
  spawnSwordWave,
  spawnRock,
  spawnButterfly,
  spawnSkull,
  spawnSunLance,
  spawnBook,
  spawnSlash,
  spawnCritFlash,
  spawnQuake,
  spawnHitPuff,
  spawnDeath,
  spawnSpin,
  spawnGoldPopup,
} from '../render/fx';
import { getUI } from '../ui';
import { buildUiState, buildUpgradePanel, buildStorePanel } from '../ui/uiState';

const HERO_KEYS = ['ONE', 'TWO', 'THREE', 'FOUR'];
const STORE_KEY = 'FIVE';

export class GameScene extends Phaser.Scene {
  private world!: World;
  private hpBars!: Phaser.GameObjects.Graphics;
  private ghost!: Phaser.GameObjects.Graphics;
  private selRing!: Phaser.GameObjects.Graphics;
  private auraFx!: Phaser.GameObjects.Graphics;
  private selectedTower: Tower | null = null;
  private selectedStore: Store | null = null;
  // the hero (or 'store') armed for deployment, or null when nothing is being deployed
  private selectedHeroId: string | null = null;
  private bestWave = 0;
  private endHandled = false;
  private enemyViews = new Map<Enemy, EnemyView>();
  private towerViews = new Map<Tower, TowerView>();
  private storeViews = new Map<Store, StoreView>();

  constructor() {
    super('Game');
  }

  create(): void {
    this.world = new World({
      level: LEVEL_ONE,
      enemyTypes: ENEMY_TYPES,
      heroTypes: HERO_TYPES,
      waves: WAVES,
      generateWave, // endless: keep escalating past the authored waves
    });
    this.bestWave = loadSave().bestWave;
    this.endHandled = false;
    this.enemyViews.clear();
    this.towerViews.clear();
    this.storeViews.clear();
    this.selectedTower = null;
    this.selectedStore = null;

    renderMap(this, LEVEL_ONE);
    this.hpBars = this.add.graphics().setDepth(9000);
    this.ghost = this.add.graphics().setDepth(8000);
    this.selRing = this.add.graphics().setDepth(7000);
    this.auraFx = this.add.graphics().setDepth(40); // under the characters, over the map

    getLoadout().forEach((id, i) => {
      this.input.keyboard?.on(`keydown-${HERO_KEYS[i]}`, () => {
        this.selectedHeroId = id;
        this.selectedTower = null;
        this.selectedStore = null;
      });
    });
    this.input.keyboard?.on(`keydown-${STORE_KEY}`, () => {
      if (!this.world.canBuildStore()) return; // store cap reached
      this.selectedHeroId = STORE.id;
      this.selectedTower = null;
      this.selectedStore = null;
    });
    this.input.keyboard?.on('keydown-SPACE', () => this.world.startNextWave());
    this.input.keyboard?.on('keydown-R', () => {
      if (this.world.status !== 'playing') this.scene.restart();
    });
    // Esc / right-click cancel the in-progress deployment
    this.input.keyboard?.on('keydown-ESC', () => {
      this.selectedHeroId = null;
      this.selectedTower = null;
      this.selectedStore = null;
    });
    this.input.mouse?.disableContextMenu();

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.rightButtonDown()) {
        this.selectedHeroId = null;
        this.selectedTower = null;
        this.selectedStore = null;
        return;
      }
      if (this.selectedHeroId) {
        this.tryPlaceBuild(p.x, p.y);
        return;
      }
      // not armed: select a placed building under the cursor (store first, then tower)
      const store = this.world.storeAt(p.x, p.y);
      if (store) {
        this.selectedStore = store;
        this.selectedTower = null;
        return;
      }
      this.selectedTower = this.world.towerAt(p.x, p.y);
      this.selectedStore = null;
    });

    const ui = getUI();
    // clicking the armed hero again cancels deployment
    ui.onSelectHero = (id) => {
      // can't arm the store once the cap is hit (cancelling an armed store still works)
      if (id === STORE.id && this.selectedHeroId !== id && !this.world.canBuildStore()) return;
      this.selectedHeroId = this.selectedHeroId === id ? null : id;
      this.selectedTower = null;
      this.selectedStore = null;
    };
    ui.onUpgrade = (path) => {
      if (this.selectedTower) this.world.upgradeTower(this.selectedTower, path);
    };
    ui.onSell = () => {
      if (this.selectedTower) {
        this.world.sellTower(this.selectedTower);
        this.selectedTower = null;
      }
    };
    ui.onSellStore = () => {
      if (this.selectedStore) {
        this.world.sellStore(this.selectedStore);
        this.selectedStore = null;
      }
    };
    ui.onUpgradeStore = (path) => {
      if (this.selectedStore) this.world.upgradeStore(this.selectedStore, path);
    };
    ui.onCycleTarget = () => this.selectedTower?.cycleTarget();
    ui.onRestart = () => {
      if (this.world.status !== 'playing') this.scene.restart();
    };
    ui.onHome = () => {
      if (this.world.status !== 'playing') location.reload();
    };
  }

  private tryPlaceBuild(x: number, y: number): void {
    if (this.world.status !== 'playing' || !this.selectedHeroId) return;
    if (this.selectedHeroId === STORE.id) {
      const { col, row } = footprintTopLeftAt(LEVEL_ONE, x, y, STORE.width, STORE.height);
      this.world.placeStore(col, row);
      return;
    }
    const { col, row } = footprintTopLeftAt(LEVEL_ONE, x, y);
    this.world.placeTower(this.selectedHeroId, col, row);
  }

  private drawGhost(): void {
    const g = this.ghost;
    g.clear();
    if (this.world.status !== 'playing' || !this.selectedHeroId) return;
    const p = this.input.activePointer;
    if (p.x < 0 || p.y < 0 || p.x > this.scale.width || p.y > this.scale.height) return;
    const cs = LEVEL_ONE.cellSize;
    if (this.selectedHeroId === STORE.id) {
      const { col, row } = footprintTopLeftAt(LEVEL_ONE, p.x, p.y, STORE.width, STORE.height);
      const ok = this.world.canBuildStore() && this.world.canPlaceStoreAt(col, row) && this.world.gold >= STORE.cost;
      g.fillStyle(ok ? 0x2ecc71 : 0xe74c3c, 0.35);
      g.lineStyle(2, ok ? 0x2ecc71 : 0xe74c3c, 0.9);
      g.fillRect(col * cs, row * cs, cs * STORE.width, cs * STORE.height);
      g.strokeRect(col * cs, row * cs, cs * STORE.width, cs * STORE.height);
      return;
    }
    const { col, row } = footprintTopLeftAt(LEVEL_ONE, p.x, p.y);
    const hero = HERO_TYPES[this.selectedHeroId];
    const ok = this.world.canPlaceAt(col, row) && this.world.gold >= hero.cost;
    g.fillStyle(ok ? 0x2ecc71 : 0xe74c3c, 0.35);
    g.lineStyle(2, ok ? 0x2ecc71 : 0xe74c3c, 0.9);
    g.fillRect(col * cs, row * cs, cs * 2, cs * 2);
    g.strokeRect(col * cs, row * cs, cs * 2, cs * 2);
  }

  private drawSelection(): void {
    const g = this.selRing;
    g.clear();
    const cs = LEVEL_ONE.cellSize;
    if (this.selectedStore) {
      const s = this.selectedStore;
      g.lineStyle(2, 0xf0d999, 0.95);
      g.strokeRect(s.pos.x - (STORE.width * cs) / 2, s.pos.y - (STORE.height * cs) / 2, STORE.width * cs, STORE.height * cs);
      return;
    }
    const t = this.selectedTower;
    if (!t) return;
    g.lineStyle(2, 0xf0d999, 0.95);
    g.strokeRect(t.pos.x - cs, t.pos.y - cs, cs * 2, cs * 2);
    g.lineStyle(1, 0xf0d999, 0.45);
    g.strokeCircle(t.pos.x, t.pos.y, t.stats.range);
  }

  update(_time: number, delta: number): void {
    if (this.world.status === 'playing') {
      this.world.update(delta / 1000);
    }
    this.consumeEvents();
    this.syncViews();
    this.drawAuras();
    this.drawHpBars();
    this.drawGhost();
    this.drawSelection();
    getUI().setUpgradePanel(
      this.selectedTower
        ? buildUpgradePanel(
            this.selectedTower.type.id,
            this.selectedTower.levels,
            this.world.gold,
            this.selectedTower.spent,
            this.selectedTower.targetMode,
          )
        : null,
    );
    getUI().setStorePanel(
      this.selectedStore
        ? buildStorePanel(this.selectedStore.levels, this.world.gold, this.selectedStore.spent)
        : null,
    );
    getUI().update(buildUiState(this.world, this.selectedHeroId, this.bestWave, getLoadout(), HERO_TYPES));
    this.handleEndState();
  }

  private consumeEvents(): void {
    for (const shot of this.world.events.shots) {
      // nearest view to the shot origin (roaming towers move, so exact equality won't hold)
      let shooter: TowerView | null = null;
      let bestD = 30;
      for (const view of this.towerViews.values()) {
        const d = Math.hypot(view.sprite.x - shot.from.x, view.sprite.y - shot.from.y);
        if (d < bestD) {
          bestD = d;
          shooter = view;
        }
      }
      shooter?.playAttack(shot.to.x, shot.to.y);
      const hero = HERO_TYPES[shot.heroId];
      if (hero?.spin) {
        spawnSpin(this, shot.from, hero.range);
      } else if (shot.heroId === 'gabriela') {
        spawnSwordWave(this, shot.from, shot.to);
        spawnHitPuff(this, shot.to);
      } else if (shot.heroId === 'bernardo') {
        spawnRock(this, shot.from, shot.to);
        spawnHitPuff(this, shot.to);
      } else if (shot.heroId === 'diwata') {
        spawnButterfly(this, shot.from, shot.to);
      } else if (shot.heroId === 'mangkukulam') {
        spawnSkull(this, shot.from, shot.to);
        spawnHitPuff(this, shot.to);
      } else if (shot.heroId === 'apolaki') {
        spawnSunLance(this, shot.from, shot.to);
        spawnHitPuff(this, shot.to);
      } else if (shot.heroId === 'rizal') {
        spawnBook(this, shot.from, shot.to);
        spawnHitPuff(this, shot.to);
      } else if (shot.heroId === 'bonifacio') {
        spawnSlash(this, shot.to);
      } else {
        spawnProjectile(this, shot.from, shot.to);
        spawnHitPuff(this, shot.to);
      }
      if (shot.crit) spawnCritFlash(this, shot.to);
    }
    for (const echo of this.world.events.echoes) {
      spawnQuake(this, echo.pos, echo.radius);
    }
    for (const death of this.world.events.deaths) {
      spawnDeath(this, death.enemyTypeId, death.pos);
    }
    for (const g of this.world.events.gold) {
      spawnGoldPopup(this, g.pos, g.amount);
    }
  }

  private syncViews(): void {
    for (const t of this.world.towers) {
      let view = this.towerViews.get(t);
      if (!view) {
        view = new TowerView(this, t);
        this.towerViews.set(t, view);
      }
      view.sync(t);
    }
    const liveTowers = new Set(this.world.towers);
    for (const [t, view] of this.towerViews) {
      if (!liveTowers.has(t)) {
        view.destroy();
        this.towerViews.delete(t);
      }
    }
    for (const st of this.world.stores) {
      if (!this.storeViews.has(st)) this.storeViews.set(st, new StoreView(this, st));
    }
    const liveStores = new Set(this.world.stores);
    for (const [st, view] of this.storeViews) {
      if (!liveStores.has(st)) {
        view.destroy();
        this.storeViews.delete(st);
      }
    }
    const live = new Set(this.world.enemies);
    for (const e of this.world.enemies) {
      let view = this.enemyViews.get(e);
      if (!view) {
        view = new EnemyView(this, e);
        this.enemyViews.set(e, view);
      }
      view.sync(e);
    }
    for (const [e, view] of this.enemyViews) {
      if (!live.has(e)) {
        view.destroy();
        this.enemyViews.delete(e);
      }
    }
  }

  // persistent aura rings: Bonifacio's fire circle and a faint gold ring for Rizal's aura
  private drawAuras(): void {
    const g = this.auraFx;
    g.clear();
    const flicker = 1 + Math.sin(this.time.now / 90) * 0.03;
    for (const t of this.world.towers) {
      const burn = t.stats.burnAura;
      if (burn) {
        const r = burn.radius * flicker;
        g.fillStyle(0xe25822, 0.1);
        g.fillCircle(t.pos.x, t.pos.y, r);
        g.lineStyle(2, 0xff8c42, 0.5);
        g.strokeCircle(t.pos.x, t.pos.y, r);
        g.lineStyle(1, 0xffc46b, 0.35);
        g.strokeCircle(t.pos.x, t.pos.y, r * 0.8);
      }
      if (t.stats.aura) {
        g.lineStyle(1.5, 0xf0d999, 0.22);
        g.strokeCircle(t.pos.x, t.pos.y, t.stats.range);
      }
    }
  }

  private drawHpBars(): void {
    const g = this.hpBars;
    g.clear();
    for (const e of this.world.enemies) {
      const frac = Math.max(0, e.hp / e.maxHp);
      const w = e.type.boss ? 44 : 22; // bosses get a fittingly bigger bar
      const h = e.type.boss ? 6 : 4;
      const y = e.type.boss ? e.pos.y - 34 : e.pos.y - 22;
      g.fillStyle(0x000000, 0.6);
      g.fillRect(e.pos.x - w / 2, y, w, h);
      g.fillStyle(e.type.boss ? 0xb86dd9 : 0x2ecc71, 1);
      g.fillRect(e.pos.x - w / 2, y, w * frac, h);
    }
  }

  private handleEndState(): void {
    if (this.world.status === 'playing' || this.endHandled) return;
    this.endHandled = true;
    saveBestWave(this.world.waveNumber);
    this.bestWave = Math.max(this.bestWave, this.world.waveNumber);
  }
}
