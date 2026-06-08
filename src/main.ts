import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 768,
  height: 480,
  backgroundColor: '#1d2b1f',
  pixelArt: true,
  parent: 'game',
  scene: [BootScene],
};

new Phaser.Game(config);
