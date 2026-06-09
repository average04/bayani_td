import Phaser from 'phaser';
import type { Vec2 } from '../game/geometry';
import { MANIFEST } from '../assets/manifest';

const FX_DEPTH = 5000;

export function spawnProjectile(scene: Phaser.Scene, from: Vec2, to: Vec2): void {
  const p = scene.add.image(from.x, from.y, MANIFEST.fx.projectile.key).setDepth(FX_DEPTH);
  scene.tweens.add({ targets: p, x: to.x, y: to.y, duration: 120, onComplete: () => p.destroy() });
}

export function spawnHitPuff(scene: Phaser.Scene, at: Vec2): void {
  const s = scene.add.sprite(at.x, at.y, MANIFEST.fx.hitPuff.key).setDepth(FX_DEPTH);
  s.play(MANIFEST.fx.hitPuff.key);
  s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => s.destroy());
}

// Expanding ring for a melee spin attack, sized to the hero's reach.
export function spawnSpin(scene: Phaser.Scene, at: Vec2, radius: number): void {
  const ring = scene.add
    .circle(at.x, at.y, radius, 0xffe28a, 0)
    .setStrokeStyle(3, 0xffe28a, 0.9)
    .setScale(0.35)
    .setDepth(FX_DEPTH);
  scene.tweens.add({
    targets: ring,
    scale: 1,
    alpha: 0,
    duration: 220,
    ease: 'Cubic.Out',
    onComplete: () => ring.destroy(),
  });
}

export function spawnDeath(scene: Phaser.Scene, enemyTypeId: string, at: Vec2): void {
  const s = scene.add.sprite(at.x, at.y, enemyTypeId).setDepth(FX_DEPTH);
  s.play(deathAnimKey(scene, enemyTypeId));
  s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => s.destroy());
}

function deathAnimKey(scene: Phaser.Scene, enemyTypeId: string): string {
  const down = `${enemyTypeId}-death-down`;
  return scene.anims.exists(down) ? down : `${enemyTypeId}-walk-down`;
}
