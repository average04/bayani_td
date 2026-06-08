import Phaser from 'phaser';
import { MANIFEST } from '../assets/manifest';

export function registerAnimations(scene: Phaser.Scene): void {
  for (const c of MANIFEST.characters) {
    for (const state of ['idle', 'walk', 'attack', 'death'] as const) {
      const spec = c.anims[state];
      scene.anims.create({
        key: `${c.key}-${state}`,
        frames: scene.anims.generateFrameNumbers(c.key, { start: spec.start, end: spec.end }),
        frameRate: spec.frameRate,
        repeat: spec.repeat,
      });
    }
  }
  const hp = MANIFEST.fx.hitPuff;
  scene.anims.create({
    key: hp.key,
    frames: scene.anims.generateFrameNumbers(hp.key, { start: 0, end: hp.frameCount - 1 }),
    frameRate: 20,
    repeat: 0,
  });
}
