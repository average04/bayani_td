import './ui/ui.css';
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { GameScene } from './scenes/GameScene';
import { LEVEL_ONE } from './game/config/levels';
import { createUI } from './ui';
import { showHomeScreen } from './ui/homeScreen';
import { showHeroSelect } from './ui/heroSelect';
import { setLoadout } from './game/config/loadout';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: LEVEL_ONE.cols * LEVEL_ONE.tileSize,
  height: LEVEL_ONE.rows * LEVEL_ONE.tileSize,
  backgroundColor: '#1d2b1f',
  pixelArt: true,
  parent: 'stage',
  scene: [BootScene, PreloadScene, GameScene],
};

let game: Phaser.Game | null = null;

// Scale the whole game column (HUD + stage + build bar) to fill the viewport, preserving
// aspect. A CSS transform keeps every absolutely-positioned overlay aligned; Phaser then
// re-reads the canvas bounds so pointer coordinates stay correct.
function fitToViewport(): void {
  const el = document.getElementById('game');
  if (!el || el.childElementCount === 0) return;
  el.style.transform = 'none';
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  if (!w || !h) return;
  const k = Math.min((window.innerWidth - 16) / w, (window.innerHeight - 12) / h);
  el.style.transform = `scale(${k.toFixed(4)})`;
  game?.scale.refresh();
}
window.addEventListener('resize', fitToViewport);

// Title screen -> hero card select -> the Phaser game boots with the chosen loadout.
showHomeScreen({
  onInfinite: () => {
    showHeroSelect({
      onStart: (loadout) => {
        setLoadout(loadout);
        createUI(document.getElementById('game')!);
        if (!game) game = new Phaser.Game(config);
        fitToViewport();
      },
    });
  },
});
