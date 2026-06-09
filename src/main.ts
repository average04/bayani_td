import './ui/ui.css';
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { GameScene } from './scenes/GameScene';
import { LEVEL_ONE } from './game/config/levels';
import { createUI } from './ui';
import { showHomeScreen } from './ui/homeScreen';

createUI(document.getElementById('game')!);

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: LEVEL_ONE.cols * LEVEL_ONE.tileSize,
  height: LEVEL_ONE.rows * LEVEL_ONE.tileSize,
  backgroundColor: '#1d2b1f',
  pixelArt: true,
  parent: 'stage',
  scene: [BootScene, PreloadScene, GameScene],
};

// Title screen first; the Phaser game is created only when a mode is chosen.
let game: Phaser.Game | null = null;
showHomeScreen({
  onInfinite: () => {
    if (!game) game = new Phaser.Game(config);
  },
});
