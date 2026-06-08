import Phaser from 'phaser';
import { World } from '../game/world';
import { LEVEL_ONE } from '../game/config/levels';
import { ENEMY_TYPES } from '../game/config/enemies';
import { HERO_TYPES } from '../game/config/heroes';
import { WAVES } from '../game/config/waves';
import { loadSave, saveBestWave } from '../services/localSave';
import type { Vec2 } from '../game/geometry';

const HERO_COLORS: Record<string, number> = {
  lapulapu: 0xffcf5c,
  gabriela: 0x5cc7ff,
};
const ENEMY_COLORS: Record<string, number> = {
  aswang: 0xc0392b,
  tiktik: 0x8e44ad,
};

export class GameScene extends Phaser.Scene {
  private world!: World;
  private gfx!: Phaser.GameObjects.Graphics;
  private hudText!: Phaser.GameObjects.Text;
  private overlayText!: Phaser.GameObjects.Text;
  private selectedHeroId = 'lapulapu';
  private bestWave = 0;
  private endHandled = false;

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

    this.gfx = this.add.graphics();

    this.hudText = this.add
      .text(8, 8, '', { fontFamily: 'monospace', fontSize: '14px', color: '#ffffff' })
      .setDepth(10);

    this.overlayText = this.add
      .text(LEVEL_ONE.cols * LEVEL_ONE.tileSize / 2, LEVEL_ONE.rows * LEVEL_ONE.tileSize / 2, '', {
        fontFamily: 'monospace',
        fontSize: '32px',
        color: '#ffffff',
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(10);

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
    this.draw();
    this.updateHud();
    this.handleEndState();
  }

  private draw(): void {
    const g = this.gfx;
    g.clear();

    // path
    g.lineStyle(LEVEL_ONE.tileSize * 0.6, 0x3a2c1f, 1);
    g.beginPath();
    const path = LEVEL_ONE.path;
    g.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) g.lineTo(path[i].x, path[i].y);
    g.strokePath();

    // build spots
    for (const s of LEVEL_ONE.buildSpots) {
      g.fillStyle(0x2e4a32, 1);
      g.fillRect(s.x - 18, s.y - 18, 36, 36);
    }

    // towers + range
    for (const t of this.world.towers) {
      g.fillStyle(0x000000, 0.12);
      g.fillCircle(t.pos.x, t.pos.y, t.type.range);
      g.fillStyle(HERO_COLORS[t.type.id] ?? 0xffffff, 1);
      g.fillCircle(t.pos.x, t.pos.y, 14);
    }

    // enemies + hp bar
    for (const e of this.world.enemies) {
      g.fillStyle(ENEMY_COLORS[e.type.id] ?? 0xffffff, 1);
      g.fillCircle(e.pos.x, e.pos.y, 10);
      const frac = Math.max(0, e.hp / e.type.maxHp);
      g.fillStyle(0x000000, 0.6);
      g.fillRect(e.pos.x - 11, e.pos.y - 18, 22, 4);
      g.fillStyle(0x2ecc71, 1);
      g.fillRect(e.pos.x - 11, e.pos.y - 18, 22 * frac, 4);
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
