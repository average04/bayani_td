import Phaser from 'phaser';
import type { Tower } from '../game/entities/tower';
import { getCharacter } from '../assets/manifest';
import { facingFromDelta } from './facing';

export class TowerView {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly key: string;

  constructor(scene: Phaser.Scene, tower: Tower) {
    this.key = tower.type.id;
    const c = getCharacter(this.key);
    const baseSheet = c ? c.anims.idle.sheet : this.key;
    this.sprite = scene.add.sprite(tower.pos.x, tower.pos.y, baseSheet);
    if (c) {
      this.sprite.setOrigin(0.5, c.originY).setScale(c.displayScale);
      if (c.tint !== undefined) this.sprite.setTint(c.tint);
    }
    this.sprite.setDepth(tower.pos.y);
    this.play(`${this.key}-idle-down`);
  }

  playAttack(targetX: number, targetY: number): void {
    const { facing, flipX } = facingFromDelta(targetX - this.sprite.x, targetY - this.sprite.y);
    this.sprite.setFlipX(flipX);
    this.sprite.play(this.resolve(`${this.key}-attack-${facing}`, `${this.key}-attack-down`), true);
    this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.sprite.play(this.resolve(`${this.key}-idle-${facing}`, `${this.key}-idle-down`));
    });
  }

  private resolve(preferred: string, fallback: string): string {
    return this.sprite.scene.anims.exists(preferred) ? preferred : fallback;
  }

  private play(animKey: string): void {
    const key = this.sprite.scene.anims.exists(animKey) ? animKey : `${this.key}-idle-down`;
    this.sprite.play(key, true);
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
