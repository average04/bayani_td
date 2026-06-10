import Phaser from 'phaser';
import type { Vec2 } from '../game/geometry';
import { MANIFEST } from '../assets/manifest';

const FX_DEPTH = 5000;

export function spawnProjectile(scene: Phaser.Scene, from: Vec2, to: Vec2): void {
  const p = scene.add.image(from.x, from.y, MANIFEST.fx.projectile.key).setDepth(FX_DEPTH);
  scene.tweens.add({ targets: p, x: to.x, y: to.y, duration: 120, onComplete: () => p.destroy() });
}

// A crescent "sword wave" that flies to the target (Gabriela's itak/bolo slash). The blade
// is a curved sliver — thickest in the middle, tapering to sharp points — drawn as a faint
// wide glow under a bright steel core, oriented along its flight path.
export function spawnSwordWave(scene: Phaser.Scene, from: Vec2, to: Vec2): void {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const g = scene.add.graphics({ x: from.x, y: from.y }).setDepth(FX_DEPTH);
  g.rotation = angle; // the crescent bulges toward +x, i.e. toward the target

  const L = 13; // half-height (tip to tip = 2L)
  const crescent = (outer: number, inner: number): Phaser.Types.Math.Vector2Like[] => {
    const steps = 10;
    const lead: Phaser.Types.Math.Vector2Like[] = [];
    const trail: Phaser.Types.Math.Vector2Like[] = [];
    for (let i = 0; i <= steps; i++) {
      const y = -L + (2 * L * i) / steps;
      const k = 1 - (y / L) ** 2; // 0 at the tips, 1 in the middle
      lead.push({ x: outer * k, y });
      trail.push({ x: inner * k, y });
    }
    return lead.concat(trail.reverse());
  };

  g.fillStyle(0xfff2b0, 0.3);
  g.fillPoints(crescent(20, 4), true); // soft golden glow
  g.fillStyle(0xeef4ff, 0.95);
  g.fillPoints(crescent(15, 7), true); // bright steel core
  g.lineStyle(2, 0xffffff, 0.9);
  g.beginPath();
  for (let i = 0; i <= 10; i++) {
    const y = -L + (2 * L * i) / 10;
    const k = 1 - (y / L) ** 2;
    if (i === 0) g.moveTo(15 * k, y);
    else g.lineTo(15 * k, y);
  }
  g.strokePath(); // crisp leading edge

  scene.tweens.add({ targets: g, x: to.x, y: to.y, duration: 130, ease: 'Quad.Out', onComplete: () => g.destroy() });
  scene.tweens.add({ targets: g, alpha: 0, duration: 55, delay: 80 });
}

// Bernardo's thrown boulder: a lumpy shaded rock that lobs in an arc and tumbles end over end.
const ROCK_PTS: Phaser.Types.Math.Vector2Like[] = [
  { x: -8, y: -2 }, { x: -5, y: -7 }, { x: 1, y: -8 }, { x: 7, y: -4 },
  { x: 8, y: 2 }, { x: 4, y: 7 }, { x: -3, y: 8 }, { x: -8, y: 3 },
];

function drawBoulder(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(0x837a6d, 1);
  g.fillPoints(ROCK_PTS, true); // base stone
  g.fillStyle(0x5f584d, 0.55);
  g.fillPoints([{ x: 8, y: 2 }, { x: 4, y: 7 }, { x: -3, y: 8 }, { x: 2, y: 1 }], true); // shaded lower-right
  g.fillStyle(0xa69c8a, 0.9);
  g.fillPoints(ROCK_PTS.map((p) => ({ x: p.x! * 0.45 - 1.5, y: p.y! * 0.45 - 2 })), true); // highlight upper-left
  g.fillStyle(0x4f483e, 0.85);
  g.fillCircle(2, 1, 1.3);
  g.fillCircle(-3, -2, 1);
  g.fillCircle(4, -2, 0.9); // pits/cracks
  g.lineStyle(1.5, 0x3f3930, 1);
  g.strokePoints(ROCK_PTS, true, true); // dark outline
}

export function spawnRock(scene: Phaser.Scene, from: Vec2, to: Vec2): void {
  const g = scene.add.graphics().setPosition(from.x, from.y).setDepth(FX_DEPTH);
  drawBoulder(g);
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const peak = Math.min(44, dist * 0.22); // lob height; longer throws arc higher
  const proxy = { t: 0 };
  scene.tweens.add({
    targets: proxy,
    t: 1,
    duration: 170,
    ease: 'Linear',
    onUpdate: () => {
      const t = proxy.t;
      g.setPosition(
        from.x + (to.x - from.x) * t,
        from.y + (to.y - from.y) * t - peak * 4 * t * (1 - t), // parabola, peak at t=0.5
      );
      g.rotation = t * Math.PI * 1.6; // tumble
    },
    onComplete: () => g.destroy(),
  });
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

// Rising "+N" gold text that floats up and fades, for gold gained at a position.
export function spawnGoldPopup(scene: Phaser.Scene, at: Vec2, amount: number): void {
  const t = scene.add
    .text(at.x, at.y - 8, `+${amount}`, {
      fontFamily: 'Trebuchet MS, sans-serif',
      fontSize: '14px',
      color: '#ffe28a',
      fontStyle: 'bold',
      stroke: '#2c1f0f',
      strokeThickness: 3,
    })
    .setOrigin(0.5)
    .setDepth(FX_DEPTH + 100);
  scene.tweens.add({
    targets: t,
    y: at.y - 30,
    alpha: 0,
    duration: 800,
    ease: 'Cubic.Out',
    onComplete: () => t.destroy(),
  });
}

function deathAnimKey(scene: Phaser.Scene, enemyTypeId: string): string {
  const down = `${enemyTypeId}-death-down`;
  return scene.anims.exists(down) ? down : `${enemyTypeId}-walk-down`;
}
