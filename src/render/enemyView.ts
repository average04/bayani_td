import Phaser from 'phaser';
import type { Enemy } from '../game/entities/enemy';
import { getCharacter } from '../assets/manifest';
import { facingFromDelta } from './facing';

export class EnemyView {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly key: string;
  private last: { x: number; y: number };

  constructor(scene: Phaser.Scene, enemy: Enemy) {
    this.key = enemy.type.id;
    const c = getCharacter(this.key);
    const baseSheet = c ? c.anims.walk.sheet : this.key;
    this.sprite = scene.add.sprite(enemy.pos.x, enemy.pos.y, baseSheet);
    if (c) this.sprite.setOrigin(0.5, c.originY).setScale(c.displayScale);
    this.sprite.setDepth(enemy.pos.y);
    this.play(`${this.key}-walk-down`);
    this.last = { x: enemy.pos.x, y: enemy.pos.y };
  }

  sync(enemy: Enemy): void {
    const dx = enemy.pos.x - this.last.x;
    const dy = enemy.pos.y - this.last.y;
    if (dx !== 0 || dy !== 0) {
      const { facing, flipX } = facingFromDelta(dx, dy);
      this.sprite.setFlipX(flipX);
      this.play(`${this.key}-walk-${facing}`);
    }
    this.last = { x: enemy.pos.x, y: enemy.pos.y };
    this.sprite.setPosition(enemy.pos.x, enemy.pos.y);
    this.sprite.setDepth(enemy.pos.y);
  }

  // Play an animation if it exists (falling back to the down variant), without restarting it.
  private play(animKey: string): void {
    const scene = this.sprite.scene;
    const key = scene.anims.exists(animKey) ? animKey : `${this.key}-walk-down`;
    if (this.sprite.anims.currentAnim?.key !== key) this.sprite.play(key, true);
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
