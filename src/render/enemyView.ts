import Phaser from 'phaser';
import type { Enemy } from '../game/entities/enemy';

export class EnemyView {
  readonly sprite: Phaser.GameObjects.Sprite;
  private lastX: number;

  constructor(scene: Phaser.Scene, enemy: Enemy) {
    this.sprite = scene.add.sprite(enemy.pos.x, enemy.pos.y, enemy.type.id).setDepth(5);
    this.sprite.play(`${enemy.type.id}-walk`);
    this.lastX = enemy.pos.x;
  }

  sync(enemy: Enemy): void {
    const dx = enemy.pos.x - this.lastX;
    if (Math.abs(dx) > 0.01) this.sprite.setFlipX(dx < 0);
    this.lastX = enemy.pos.x;
    this.sprite.setPosition(enemy.pos.x, enemy.pos.y);
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
