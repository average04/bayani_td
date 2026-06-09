import Phaser from 'phaser';
import { MANIFEST, type Facing } from '../assets/manifest';

const STATES = ['idle', 'walk', 'attack', 'death'] as const;
const FACINGS: Facing[] = ['down', 'up', 'side'];

export function registerAnimations(scene: Phaser.Scene): void {
  for (const c of MANIFEST.characters) {
    for (const state of STATES) {
      const clip = c.anims[state];
      for (const facing of FACINGS) {
        const row = clip.rows[facing];
        if (!row) continue;
        scene.anims.create({
          key: `${c.key}-${state}-${facing}`,
          frames: scene.anims.generateFrameNumbers(clip.sheet, { start: row.start, end: row.end }),
          frameRate: clip.frameRate,
          repeat: clip.repeat,
        });
      }
    }
    if (c.attackSpin) {
      scene.anims.create({
        key: `${c.key}-attack-spin`,
        frames: scene.anims.generateFrameNumbers(c.attackSpin.sheet, { frames: c.attackSpin.frames }),
        frameRate: c.attackSpin.frameRate,
        repeat: 0,
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
