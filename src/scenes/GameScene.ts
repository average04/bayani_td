import Phaser from 'phaser';
import { World } from '../game/world';
import { LEVEL_ONE } from '../game/config/levels';
import { ENEMY_TYPES } from '../game/config/enemies';
import { HERO_TYPES } from '../game/config/heroes';
import { WAVES } from '../game/config/waves';
import { loadSave, saveBestWave } from '../services/localSave';
import type { Vec2 } from '../game/geometry';
import type { Enemy } from '../game/entities/enemy';
import type { Tower } from '../game/entities/tower';
import { renderMap } from '../render/mapRenderer';
import { EnemyView } from '../render/enemyView';
import { TowerView } from '../render/towerView';
import { spawnProjectile, spawnHitPuff, spawnDeath } from '../render/fx';

export class GameScene extends Phaser.Scene {
  private world!: World;
  private hpBars!: Phaser.GameObjects.Graphics;
  private hudText!: Phaser.GameObjects.Text;
  private overlayText!: Phaser.GameObjects.Text;
  private selectedHeroId = 'lapulapu';
  private bestWave = 0;
  private endHandled = false;
  private enemyViews = new Map<Enemy, EnemyView>();
  private towerViews = new Map<Tower, TowerView>();

  constructor() {
    super('Game');
  }

  create(): void {
    this.world = new World({
      level: LEVEL_ONE,
      enemyTypes: ENEMY_TYPES,
      heroTypes: HERO_TYPES,
      waves: WAVES,
    });
    this.bestWave = loadSave().bestWave;
    this.endHandled = false;
    this.enemyViews.clear();
    this.towerViews.clear();

    renderMap(this, LEVEL_ONE);
    this.hpBars = this.add.graphics().setDepth(9000);

    this.hudText = this.add
      .text(8, 8, '', { fontFamily: 'monospace', fontSize: '14px', color: '#ffffff' })
      .setDepth(10000);

    this.overlayText = this.add
      .text(this.scale.width / 2, this.scale.height / 2, '', {
        fontFamily: 'monospace',
        fontSize: '32px',
        color: '#ffffff',
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(10000);

    this.input.keyboard?.on('keydown-ONE', () => (this.selectedHeroId = 'lapulapu'));
    this.input.keyboard?.on('keydown-TWO', () => (this.selectedHeroId = 'gabriela'));
    this.input.keyboard?.on('keydown-SPACE', () => this.world.startNextWave());
    this.input.keyboard?.on('keydown-R', () => {
      if (this.world.status !== 'playing') this.scene.restart();
    });

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.tryPlaceTower(p.x, p.y));
  }

  private tryPlaceTower(x: number, y: number): void {
    if (this.world.status !== 'playing') return;
    const spot = this.nearestBuildSpot({ x, y });
    if (spot) this.world.placeTower(this.selectedHeroId, spot);
  }

  private nearestBuildSpot(p: Vec2): Vec2 | null {
    const half = LEVEL_ONE.tileSize / 2;
    for (const s of LEVEL_ONE.buildSpots) {
      if (Math.abs(s.x - p.x) <= half && Math.abs(s.y - p.y) <= half) return s;
    }
    return null;
  }

  update(_time: number, delta: number): void {
    if (this.world.status === 'playing') {
      this.world.update(delta / 1000);
    }
    this.consumeEvents();
    this.syncViews();
    this.drawHpBars();
    this.updateHud();
    this.handleEndState();
  }

  private consumeEvents(): void {
    for (const shot of this.world.events.shots) {
      for (const view of this.towerViews.values()) {
        if (view.sprite.x === shot.from.x && view.sprite.y === shot.from.y) {
          view.playAttack(shot.to.x, shot.to.y);
        }
      }
      spawnProjectile(this, shot.from, shot.to);
      spawnHitPuff(this, shot.to);
    }
    for (const death of this.world.events.deaths) {
      spawnDeath(this, death.enemyTypeId, death.pos);
    }
  }

  private syncViews(): void {
    for (const t of this.world.towers) {
      if (!this.towerViews.has(t)) {
        this.towerViews.set(t, new TowerView(this, t));
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

  private drawHpBars(): void {
    const g = this.hpBars;
    g.clear();
    for (const e of this.world.enemies) {
      const frac = Math.max(0, e.hp / e.type.maxHp);
      g.fillStyle(0x000000, 0.6);
      g.fillRect(e.pos.x - 11, e.pos.y - 22, 22, 4);
      g.fillStyle(0x2ecc71, 1);
      g.fillRect(e.pos.x - 11, e.pos.y - 22, 22 * frac, 4);
    }
  }

  private updateHud(): void {
    const w = this.world;
    const hero = HERO_TYPES[this.selectedHeroId];
    this.hudText.setText(
      [
        `Gold: ${w.gold}   Lives: ${w.lives}   Wave: ${w.waveNumber}/${w.totalWaves}   Best: ${this.bestWave}`,
        `Selected: ${hero.name} ($${hero.cost})   [1] Lapu-Lapu  [2] Gabriela   [SPACE] start wave`,
      ].join('\n'),
    );
  }

  private handleEndState(): void {
    if (this.world.status === 'playing' || this.endHandled) return;
    this.endHandled = true;
    const reached = this.world.waveNumber;
    saveBestWave(reached);
    this.bestWave = Math.max(this.bestWave, reached);
    const msg = this.world.status === 'won' ? 'VICTORY!' : 'DEFEAT';
    this.overlayText.setText(`${msg}\nReached wave ${reached}\nPress R to restart`);
  }
}
