import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    // No assets to preload yet (placeholder graphics are drawn immediately).
    this.scene.start('Game');
  }
}
