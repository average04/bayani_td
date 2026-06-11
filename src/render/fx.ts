import Phaser from 'phaser';
import type { Vec2 } from '../game/geometry';
import { MANIFEST } from '../assets/manifest';
import { HERO_TYPES } from '../game/config/heroes';

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

// Diwata's spirit butterfly: teal wings that flap and flutter along a wavy path to the target.
function drawButterfly(g: Phaser.GameObjects.Graphics): void {
  // wings (local +x = forward; right side y>0, left side y<0), forewings larger than hindwings
  const wing = (x: number, y: number, r: number): void => {
    g.fillStyle(0x6fc99a, 0.95);
    g.fillCircle(x, y, r);
    g.fillStyle(0xcdeede, 0.85);
    g.fillCircle(x + 0.5, y, r * 0.4); // pale inner
    g.fillStyle(0x2f6b4c, 0.9);
    g.fillCircle(x + r * 0.5, y + (y > 0 ? r * 0.4 : -r * 0.4), 0.9); // wing spot
  };
  wing(3, 5, 4.2);
  wing(3, -5, 4.2); // forewings
  wing(-2.5, 5, 3); // hindwings
  wing(-2.5, -5, 3);
  g.fillStyle(0x2a2e26, 1);
  g.fillCircle(-4, 0, 1.5);
  g.fillCircle(0, 0, 1.7);
  g.fillCircle(4, 0, 1.4);
  g.fillCircle(6.5, 0, 1.6); // segmented body + head
  g.lineStyle(1, 0x2a2e26, 0.9);
  g.lineBetween(6.5, 0, 9, -2.5);
  g.lineBetween(6.5, 0, 9, 2.5); // antennae
}

export function spawnButterfly(scene: Phaser.Scene, from: Vec2, to: Vec2): void {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const g = scene.add.graphics().setDepth(FX_DEPTH);
  drawButterfly(g);
  g.rotation = angle;
  const px = -Math.sin(angle);
  const py = Math.cos(angle); // perpendicular to travel
  const proxy = { t: 0 };
  scene.tweens.add({
    targets: proxy,
    t: 1,
    duration: 220,
    ease: 'Sine.InOut',
    onUpdate: () => {
      const t = proxy.t;
      const wob = Math.sin(t * Math.PI * 3) * 7 * (1 - t); // flutter side-to-side, settling at the target
      g.setPosition(from.x + (to.x - from.x) * t + px * wob, from.y + (to.y - from.y) * t + py * wob);
    },
    onComplete: () => g.destroy(),
  });
  scene.tweens.add({ targets: g, scaleY: 0.5, duration: 60, yoyo: true, repeat: 2, ease: 'Sine.InOut' }); // wing flap
}

// Mangkukulam's cursed skull: a glowing purple skull that bobs and wobbles to the target.
function drawSkull(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(0x8a4fd0, 0.3);
  g.fillCircle(0, 0, 9); // sickly aura
  g.fillStyle(0xc9b3e6, 1);
  g.fillCircle(0, -1, 6); // cranium
  g.fillRoundedRect(-3.6, 2.5, 7.2, 4.2, 1.6); // jaw
  g.fillStyle(0xe6d8f7, 0.7);
  g.fillCircle(-2, -3, 1.6); // highlight
  g.fillStyle(0x3a1d5c, 1);
  g.fillCircle(-2.4, -1, 1.9);
  g.fillCircle(2.4, -1, 1.9); // eye sockets
  g.fillTriangle(0, 0.5, -1.1, 2.6, 1.1, 2.6); // nasal cavity
  g.lineStyle(1, 0x6a4a90, 0.9);
  g.lineBetween(-1.4, 2.8, -1.4, 6.2);
  g.lineBetween(1.4, 2.8, 1.4, 6.2); // teeth gaps
}

export function spawnSkull(scene: Phaser.Scene, from: Vec2, to: Vec2): void {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const g = scene.add.graphics().setDepth(FX_DEPTH);
  drawSkull(g);
  const px = -Math.sin(angle);
  const py = Math.cos(angle);
  const proxy = { t: 0 };
  scene.tweens.add({
    targets: proxy,
    t: 1,
    duration: 180,
    ease: 'Linear',
    onUpdate: () => {
      const t = proxy.t;
      const bob = Math.sin(t * Math.PI * 2.5) * 5 * (1 - t * 0.5);
      g.setPosition(from.x + (to.x - from.x) * t + px * bob, from.y + (to.y - from.y) * t + py * bob);
      g.rotation = Math.sin(t * Math.PI * 4) * 0.25; // eerie wobble
    },
    onComplete: () => g.destroy(),
  });
}

// Apolaki's sun lance: a long blazing golden spear of light that streaks to the target.
export function spawnSunLance(scene: Phaser.Scene, from: Vec2, to: Vec2): void {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const g = scene.add.graphics({ x: from.x, y: from.y }).setDepth(FX_DEPTH);
  g.rotation = angle;
  const L = 30; // lance half-length
  const lance = (len: number, w: number): Phaser.Types.Math.Vector2Like[] => [
    { x: len, y: 0 }, { x: len * 0.25, y: w }, { x: -len, y: 0 }, { x: len * 0.25, y: -w },
  ];
  g.fillStyle(0xffb347, 0.35);
  g.fillPoints(lance(L * 1.2, 7), true); // outer heat haze
  g.fillStyle(0xffd166, 0.85);
  g.fillPoints(lance(L, 4), true); // golden body
  g.fillStyle(0xfff6d8, 1);
  g.fillPoints(lance(L * 0.9, 1.8), true); // white-hot core
  scene.tweens.add({ targets: g, x: to.x, y: to.y, duration: 90, ease: 'Quad.In', onComplete: () => g.destroy() });
}

// Rizal's thrown book: an open tome that tumbles to the target, pages out.
function drawBook(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(0x6e3b1e, 1);
  g.fillRect(-9, -6, 18, 12); // leather cover
  g.fillStyle(0xf2e8cf, 1);
  g.fillRect(-7.5, -4.5, 7, 9); // left page
  g.fillRect(0.5, -4.5, 7, 9); // right page
  g.lineStyle(1, 0xb9a583, 0.9);
  for (const y of [-2, 0.5, 3]) {
    g.lineBetween(-6.5, y, -1.5, y);
    g.lineBetween(1.5, y, 6.5, y); // lines of text
  }
  g.lineStyle(1.5, 0x4a2613, 1);
  g.lineBetween(0, -6, 0, 6); // spine
}

export function spawnBook(scene: Phaser.Scene, from: Vec2, to: Vec2): void {
  const g = scene.add.graphics().setPosition(from.x, from.y).setDepth(FX_DEPTH);
  drawBook(g);
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const peak = Math.min(30, dist * 0.16);
  const proxy = { t: 0 };
  scene.tweens.add({
    targets: proxy,
    t: 1,
    duration: 160,
    ease: 'Linear',
    onUpdate: () => {
      const t = proxy.t;
      g.setPosition(
        from.x + (to.x - from.x) * t,
        from.y + (to.y - from.y) * t - peak * 4 * t * (1 - t),
      );
      g.rotation = t * Math.PI * 2.2; // fluttering tumble
    },
    onComplete: () => g.destroy(),
  });
}

// Bonifacio's bolo slash: a wide steel arc with an ember trail biting across the target.
export function spawnSlash(scene: Phaser.Scene, at: Vec2): void {
  const g = scene.add.graphics({ x: at.x, y: at.y }).setDepth(FX_DEPTH);
  g.rotation = Math.random() * Math.PI;
  g.lineStyle(7, 0xffb070, 0.35);
  g.beginPath();
  g.arc(0, 0, 18, -0.9, 1.1);
  g.strokePath(); // ember glow under the steel
  g.lineStyle(4.5, 0xf4f7fa, 0.95);
  g.beginPath();
  g.arc(0, 0, 18, -0.8, 1.0);
  g.strokePath();
  g.lineStyle(2, 0xffffff, 1);
  g.beginPath();
  g.arc(0, 0, 18, -0.6, 0.8);
  g.strokePath(); // bright leading edge
  scene.tweens.add({
    targets: g,
    rotation: g.rotation + 1.6,
    alpha: 0,
    duration: 180,
    ease: 'Quad.Out',
    onComplete: () => g.destroy(),
  });
}

// Power-shot flash (Rampage/Deadeye crits): a golden starburst + expanding ring at impact.
export function spawnCritFlash(scene: Phaser.Scene, at: Vec2): void {
  const g = scene.add.graphics({ x: at.x, y: at.y }).setDepth(FX_DEPTH + 1);
  g.fillStyle(0xffe28a, 0.95);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    g.fillTriangle(
      Math.cos(a) * 16, Math.sin(a) * 16,
      Math.cos(a + 1.35) * 4, Math.sin(a + 1.35) * 4,
      Math.cos(a - 1.35) * 4, Math.sin(a - 1.35) * 4,
    );
  }
  g.lineStyle(2.5, 0xffd166, 0.9);
  g.strokeCircle(0, 0, 7);
  g.setScale(0.4);
  scene.tweens.add({ targets: g, scale: 1.25, alpha: 0, duration: 240, ease: 'Cubic.Out', onComplete: () => g.destroy() });
}

// Aftershock landing: a dusty shockwave ring rippling out across the ground.
export function spawnQuake(scene: Phaser.Scene, at: Vec2, radius: number): void {
  const g = scene.add.graphics({ x: at.x, y: at.y }).setDepth(FX_DEPTH - 1);
  g.lineStyle(5, 0x9a8568, 0.85);
  g.strokeCircle(0, 0, 10);
  g.lineStyle(2, 0x6e5b40, 0.7);
  g.strokeCircle(0, 0, 6);
  const target = Math.max(20, radius);
  scene.tweens.add({
    targets: g,
    scale: target / 10,
    alpha: 0,
    duration: 320,
    ease: 'Quad.Out',
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

// One entry point for a hero's signature shot FX (projectile + impact + crit flash).
// Used for both the local board and the replayed rival board.
export function spawnHeroShotFx(
  scene: Phaser.Scene,
  heroId: string,
  from: Vec2,
  to: Vec2,
  crit = false,
): void {
  const hero = HERO_TYPES[heroId];
  if (hero?.spin) {
    spawnSpin(scene, from, hero.range);
  } else if (heroId === 'gabriela') {
    spawnSwordWave(scene, from, to);
    spawnHitPuff(scene, to);
  } else if (heroId === 'bernardo') {
    spawnRock(scene, from, to);
    spawnHitPuff(scene, to);
  } else if (heroId === 'diwata') {
    spawnButterfly(scene, from, to);
  } else if (heroId === 'mangkukulam') {
    spawnSkull(scene, from, to);
    spawnHitPuff(scene, to);
  } else if (heroId === 'apolaki') {
    spawnSunLance(scene, from, to);
    spawnHitPuff(scene, to);
  } else if (heroId === 'rizal') {
    spawnBook(scene, from, to);
    spawnHitPuff(scene, to);
  } else if (heroId === 'bonifacio') {
    spawnSlash(scene, to);
  } else {
    spawnProjectile(scene, from, to);
    spawnHitPuff(scene, to);
  }
  if (crit) spawnCritFlash(scene, to);
}
