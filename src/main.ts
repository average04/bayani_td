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
import { showLobby } from './ui/lobby';
import { getSession, setSession, type MatchSession } from './net/session';
import { BOARD_W, BOARD_GAP } from './scenes/GameScene';

// Built lazily: multiplayer renders BOTH boards side by side (Bloons-Battles style),
// so the canvas is double-wide plus a divider gap.
function buildConfig(): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    width: getSession() ? BOARD_W * 2 + BOARD_GAP : BOARD_W,
    height: LEVEL_ONE.rows * LEVEL_ONE.tileSize,
    backgroundColor: '#1d2b1f',
    pixelArt: true,
    parent: 'stage',
    scene: [BootScene, PreloadScene, GameScene],
  };
}

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
  // Phaser maps pointer coordinates off the canvas' rendered bounds; refresh them so
  // clicks stay accurate under the new transform (only once the canvas exists).
  if (game?.isBooted) game.scale.refresh();
  else game?.events.once(Phaser.Core.Events.READY, () => game?.scale.refresh());
}
window.addEventListener('resize', fitToViewport);

function startGame(): void {
  createUI(document.getElementById('game')!);
  if (!game) game = new Phaser.Game(buildConfig());
  fitToViewport();
}

function readyThenStart(
  session: MatchSession,
  readyState: { peerReady: boolean; onPeerReady: () => void },
): void {
  const overlay = document.createElement('div');
  overlay.className = 'ui-countdown';
  overlay.textContent = 'Waiting for your rival…';
  document.body.appendChild(overlay);
  let started = false;
  const maybeStart = (): void => {
    if (started || !readyState.peerReady) return;
    started = true;
    let n = 3;
    overlay.textContent = String(n);
    const tick = window.setInterval(() => {
      n -= 1;
      if (n > 0) {
        overlay.textContent = String(n);
      } else {
        window.clearInterval(tick);
        overlay.remove();
        startGame();
      }
    }, 1000);
  };
  readyState.onPeerReady = maybeStart;
  session.transport.on('peerLeave', () => {
    // active until GameScene takes over the handler; a leave during card-select
    // or the countdown aborts the match outright
    overlay.textContent = 'Rival left. Returning home…';
    setTimeout(() => location.reload(), 1500);
  });
  // a peer that silently vanished before our handler registered would stall us forever;
  // the pick timer is 30s, so 45s with no 'ready' means the match is dead
  setTimeout(() => {
    if (!started) {
      overlay.textContent = 'Rival is not responding. Returning home…';
      setTimeout(() => location.reload(), 1500);
    }
  }, 45_000);
  session.transport.emit('ready');
  maybeStart();
}

// Title screen -> hero card select -> the Phaser game boots with the chosen loadout.
showHomeScreen({
  onInfinite: () => {
    showHeroSelect({
      onStart: (loadout) => {
        setLoadout(loadout);
        startGame();
      },
    });
  },
  onMultiplayer: () => {
    showLobby({
      onBack: () => location.reload(),
      onMatched: (session) => {
        setSession(session);
        const readyState = { peerReady: false, onPeerReady: () => {} };
        session.transport.on('ready', () => {
          readyState.peerReady = true;
          readyState.onPeerReady();
        });
        showHeroSelect(
          {
            onStart: (loadout) => {
              setLoadout(loadout);
              readyThenStart(session, readyState);
            },
          },
          { timerS: 30 }, // both players are on the same pick clock
        );
      },
    });
  },
});
