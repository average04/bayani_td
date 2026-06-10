import Phaser from 'phaser';
import type { LevelConfig } from '../game/config/levels';
import { ENEMY_TYPES } from '../game/config/enemies';
import { getCharacter } from '../assets/manifest';
import { facingFromDelta } from './facing';
import { renderMap } from './mapRenderer';
import type { TowerSnap, EnemySnap } from '../net/types';

// Renders the opponent's battlefield with the REAL map art and character sprites
// (Bloons-Battles style): a full second board at offsetX, driven by interpolated
// network snapshots instead of a local World.
export class RivalBoardView {
  private readonly scene: Phaser.Scene;
  private readonly offsetX: number;
  private readonly hpBars: Phaser.GameObjects.Graphics;
  private enemySprites = new Map<number, Phaser.GameObjects.Sprite>();
  private towerSprites: { heroId: string; sprite: Phaser.GameObjects.Sprite }[] = [];

  constructor(scene: Phaser.Scene, level: LevelConfig, offsetX: number, nickname: string) {
    this.scene = scene;
    this.offsetX = offsetX;
    renderMap(scene, level, offsetX);
    this.hpBars = scene.add.graphics().setDepth(9000);
    scene.add
      .text(offsetX + 8, 6, nickname, {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#ffb09a',
        stroke: '#2c1f0f',
        strokeThickness: 3,
      })
      .setDepth(9500);
  }

  /** Mirror the latest (interpolated) snapshot onto the sprites. */
  sync(board: { towers: TowerSnap[]; enemies: EnemySnap[] } | null): void {
    const g = this.hpBars;
    g.clear();
    if (!board) return;

    // towers, matched by index (the list is order-stable on the sender)
    for (let i = 0; i < board.towers.length; i++) {
      const t = board.towers[i];
      let entry = this.towerSprites[i];
      if (!entry || entry.heroId !== t.heroId) {
        entry?.sprite.destroy();
        const sprite = this.makeSprite(t.heroId);
        this.playIfExists(sprite, `${t.heroId}-idle-down`);
        entry = { heroId: t.heroId, sprite };
        this.towerSprites[i] = entry;
      }
      entry.sprite.setPosition(this.offsetX + t.x, t.y).setDepth(t.y);
    }
    for (let i = board.towers.length; i < this.towerSprites.length; i++) {
      this.towerSprites[i].sprite.destroy();
    }
    this.towerSprites.length = Math.min(this.towerSprites.length, board.towers.length);

    // enemies, matched by their stable snapshot id
    const seen = new Set<number>();
    for (const e of board.enemies) {
      seen.add(e.id);
      let s = this.enemySprites.get(e.id);
      if (!s) {
        s = this.makeSprite(e.typeId);
        s.setPosition(this.offsetX + e.x, e.y);
        this.playIfExists(s, `${e.typeId}-walk-down`);
        this.enemySprites.set(e.id, s);
      }
      const nx = this.offsetX + e.x;
      const ny = e.y;
      const dx = nx - s.x;
      const dy = ny - s.y;
      if (Math.hypot(dx, dy) > 0.5) {
        const { facing, flipX } = facingFromDelta(dx, dy);
        s.setFlipX(flipX);
        this.playIfExists(s, `${e.typeId}-walk-${facing}`, `${e.typeId}-walk-down`);
      }
      s.setPosition(nx, ny).setDepth(ny);

      const boss = ENEMY_TYPES[e.typeId]?.boss;
      const w = boss ? 44 : 22;
      const h = boss ? 6 : 4;
      const by = boss ? ny - 34 : ny - 22;
      const frac = Math.max(0, Math.min(1, e.hp));
      g.fillStyle(0x000000, 0.6);
      g.fillRect(nx - w / 2, by, w, h);
      g.fillStyle(boss ? 0xb86dd9 : 0x2ecc71, 1);
      g.fillRect(nx - w / 2, by, w * frac, h);
    }
    for (const [id, s] of this.enemySprites) {
      if (!seen.has(id)) {
        s.destroy();
        this.enemySprites.delete(id);
      }
    }
  }

  private makeSprite(characterKey: string): Phaser.GameObjects.Sprite {
    const c = getCharacter(characterKey);
    const sheet = c ? c.anims.idle.sheet : characterKey;
    const s = this.scene.add.sprite(0, 0, sheet);
    if (c) {
      s.setOrigin(0.5, c.originY).setScale(c.displayScale);
      if (c.tint !== undefined) s.setTint(c.tint);
    }
    return s;
  }

  private playIfExists(s: Phaser.GameObjects.Sprite, key: string, fallback?: string): void {
    if (this.scene.anims.exists(key)) s.play(key, true);
    else if (fallback && this.scene.anims.exists(fallback)) s.play(fallback, true);
  }
}
