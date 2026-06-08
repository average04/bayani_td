import Phaser from 'phaser';
import type { Tower } from '../game/entities/tower';

export class TowerView {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly key: string;

  constructor(scene: Phaser.Scene, tower: Tower) {
    this.key = tower.type.id;
    this.sprite = scene.add.sprite(tower.pos.x, tower.pos.y, this.key).setDepth(6);
    this.sprite.play(`${this.key}-idle`);
  }

  playAttack(targetX: number): void {
    this.sprite.setFlipX(targetX < this.sprite.x);
    this.sprite.play(`${this.key}-attack`, true);
    this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.sprite.play(`${this.key}-idle`);
    });
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
