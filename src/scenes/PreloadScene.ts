import Phaser from 'phaser';
import { MANIFEST } from '../assets/manifest';
import { registerAnimations } from '../render/animations';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload(): void {
    this.add
      .text(this.scale.width / 2, this.scale.height / 2, 'Loading…', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    for (const s of MANIFEST.sheets) {
      this.load.spritesheet(s.key, s.path, { frameWidth: s.frameWidth, frameHeight: s.frameHeight });
    }
    this.load.image(MANIFEST.fx.projectile.key, MANIFEST.fx.projectile.path);
    this.load.spritesheet(MANIFEST.fx.hitPuff.key, MANIFEST.fx.hitPuff.path, {
      frameWidth: MANIFEST.fx.hitPuff.frameWidth,
      frameHeight: MANIFEST.fx.hitPuff.frameHeight,
    });
    this.load.image(MANIFEST.map.ground.key, MANIFEST.map.ground.path);
    this.load.image(MANIFEST.map.pathTile.key, MANIFEST.map.pathTile.path);
    this.load.image(MANIFEST.map.buildMarker.key, MANIFEST.map.buildMarker.path);
  }

  create(): void {
    registerAnimations(this);
    this.scene.start('Game');
  }
}
