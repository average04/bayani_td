import Phaser from 'phaser';
import type { Vec2 } from '../game/geometry';
import { MANIFEST } from '../assets/manifest';

export function spawnProjectile(scene: Phaser.Scene, from: Vec2, to: Vec2): void {
  const p = scene.add.image(from.x, from.y, MANIFEST.fx.projectile.key).setDepth(7);
  scene.tweens.add({
    targets: p,
    x: to.x,
    y: to.y,
    duration: 120,
    onComplete: () => p.destroy(),
  });
}

export function spawnHitPuff(scene: Phaser.Scene, at: Vec2): void {
  const s = scene.add.sprite(at.x, at.y, MANIFEST.fx.hitPuff.key).setDepth(8);
  s.play(MANIFEST.fx.hitPuff.key);
  s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => s.destroy());
}

export function spawnDeath(scene: Phaser.Scene, enemyTypeId: string, at: Vec2): void {
  const s = scene.add.sprite(at.x, at.y, enemyTypeId).setDepth(4);
  s.play(`${enemyTypeId}-death`);
  s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => s.destroy());
}
