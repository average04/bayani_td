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

// A sword spinning so fast around the hero it reads as a blurred steel whirl (melee spin):
// a faint swept disc + a few ghosted blade streaks, rotating fast and fading out.
export function spawnSpin(scene: Phaser.Scene, at: Vec2, radius: number): void {
  const r = Math.max(34, radius * 0.95);
  const g = scene.add.graphics({ x: at.x, y: at.y }).setDepth(FX_DEPTH);
  const streak = (deg: number, w: number): void => {
    const t = (deg * Math.PI) / 180;
    const dx = Math.cos(t);
    const dy = Math.sin(t);
    g.fillPoints([{ x: -dy * w, y: dx * w }, { x: dy * w, y: -dx * w }, { x: dx * r, y: dy * r }], true);
  };
  g.fillStyle(0xcfd6e0, 0.12);
  g.fillCircle(0, 0, r); // soft swept disc (the blur the blade carves out)
  g.fillStyle(0xeef2f7, 0.4);
  streak(0, 4);
  streak(120, 4);
  streak(240, 4); // ghosted blade streaks
  g.lineStyle(2, 0xeef2f7, 0.5);
  g.strokeCircle(0, 0, r * 0.96); // bright leading rim
  scene.tweens.add({ targets: g, angle: 1440, duration: 300, ease: 'Linear', onComplete: () => g.destroy() });
  scene.tweens.add({ targets: g, alpha: 0, duration: 130, delay: 170 });
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
