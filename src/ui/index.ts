import { HERO_TYPES, HERO_ORDER, type HeroType } from '../game/config/heroes';
import type { UiState } from './uiState';

export interface UI {
  update(vm: UiState): void;
  onSelectHero: (id: string) => void;
  onStartWave: () => void;
  onRestart: () => void;
}

let instance: UI | null = null;

export function getUI(): UI {
  if (!instance) throw new Error('UI not created');
  return instance;
}

function el<T extends HTMLElement = HTMLElement>(tag: string, cls: string, parent?: HTMLElement): T {
  const node = document.createElement(tag) as T;
  if (cls) node.className = cls;
  if (parent) parent.appendChild(node);
  return node;
}

function effectText(h: HeroType): string {
  if (h.splashRadius) return `Splash r${h.splashRadius}`;
  if (h.slow) return `Slow x${h.slow.factor} / ${h.slow.duration}s`;
  if (h.poison) return `Poison ${h.poison.dps}/s / ${h.poison.duration}s`;
  return 'Single target';
}

export function createUI(mount: HTMLElement): UI {
  mount.innerHTML = '';

  // top HUD bar
  const top = el('div', 'ui-top', mount);
  const statValue = (icon: string, label: string): HTMLElement => {
    const s = el('div', 'ui-stat', top);
    el('span', `ui-ico ui-ico-${icon}`, s);
    const box = el('div', 'ui-statval', s);
    el('span', 'ui-lab', box).textContent = label;
    return el('b', '', box);
  };
  const livesV = statValue('lives', 'Lives');
  const goldV = statValue('gold', 'Gold');
  const waveStat = el('div', 'ui-stat ui-wave', top);
  el('span', 'ui-ico ui-ico-wave', waveStat);
  const waveBox = el('div', 'ui-statval', waveStat);
  el('span', 'ui-lab', waveBox).textContent = 'Wave';
  const waveV = el('b', '', waveBox);
  const bestStat = el('div', 'ui-stat', top);
  const bestBox = el('div', 'ui-statval', bestStat);
  el('span', 'ui-lab', bestBox).textContent = 'Best';
  const bestV = el('b', '', bestBox);

  // stage (Phaser mounts here) + overlay
  const stage = el('div', 'ui-stage', mount);
  stage.id = 'stage';
  const overlay = el('div', 'ui-overlay', stage);

  const startBtn = el<HTMLButtonElement>('button', 'ui-start', overlay);
  startBtn.textContent = 'START WAVE';

  const tooltip = el('div', 'ui-tooltip', overlay);
  tooltip.style.display = 'none';

  // banner shown while a hero is armed for deployment
  const deploy = el('div', 'ui-deploy', overlay);
  deploy.style.display = 'none';

  const endPanel = el('div', 'ui-end', overlay);
  endPanel.style.display = 'none';
  const endTitle = el('h2', 'ui-end-title', endPanel);
  const endSub = el('p', 'ui-end-sub', endPanel);
  const restartBtn = el<HTMLButtonElement>('button', 'ui-restart', endPanel);
  restartBtn.textContent = 'RESTART';

  // build menu
  const bottom = el('div', 'ui-bottom', mount);
  const tiles: Record<string, HTMLElement> = {};
  HERO_ORDER.forEach((id, i) => {
    const h = HERO_TYPES[id];
    const tile = el('div', `ui-tile ui-tile-${id}`, bottom);
    el('span', `ui-portrait ui-portrait-${id}`, tile);
    el('div', 'ui-tname', tile).textContent = h.name;
    el('small', 'ui-tcost', tile).textContent = `$${h.cost}`;
    el('span', 'ui-tkey', tile).textContent = `[${i + 1}]`;
    tile.addEventListener('click', () => ui.onSelectHero(id));
    tile.addEventListener('mouseenter', () => {
      tooltip.innerHTML =
        `<h4>${h.name}</h4>` +
        `<div class="ui-trow"><span>Range</span><b>${h.range}</b></div>` +
        `<div class="ui-trow"><span>Damage</span><b>${h.damage}</b></div>` +
        `<div class="ui-trow"><span>Attack Speed</span><b>${h.fireRate}/s</b></div>` +
        `<div class="ui-trow"><span>Effect</span><b>${effectText(h)}</b></div>` +
        `<div class="ui-trow"><span>Cost</span><b>$${h.cost}</b></div>`;
      tooltip.style.display = 'block';
    });
    tile.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
    });
    tiles[id] = tile;
  });

  const ui: UI = {
    onSelectHero: () => {},
    onStartWave: () => {},
    onRestart: () => {},
    update(vm: UiState): void {
      livesV.textContent = String(vm.lives);
      goldV.textContent = String(vm.gold);
      waveV.textContent = `${vm.wave} / ${vm.totalWaves}`;
      bestV.textContent = String(vm.bestWave);
      startBtn.disabled = !vm.canStartWave;
      for (const h of vm.heroes) {
        const tile = tiles[h.id];
        tile.classList.toggle('sel', h.selected);
        tile.classList.toggle('poor', !h.affordable);
      }
      if (vm.status === 'playing' && vm.selectedHeroId) {
        const h = HERO_TYPES[vm.selectedHeroId];
        deploy.innerHTML =
          `Deploying: ${h.name}` +
          ` <span class="ui-deploy-hint">click to place &middot; right-click / Esc to cancel</span>`;
        deploy.style.display = 'flex';
      } else {
        deploy.style.display = 'none';
      }
      if (vm.status === 'playing') {
        endPanel.style.display = 'none';
      } else {
        endPanel.style.display = 'flex';
        endTitle.textContent = vm.status === 'won' ? 'VICTORY' : 'DEFEAT';
        endTitle.className = `ui-end-title ${vm.status}`;
        endSub.textContent = `Reached wave ${vm.wave} / ${vm.totalWaves}`;
      }
    },
  };
  startBtn.addEventListener('click', () => ui.onStartWave());
  restartBtn.addEventListener('click', () => ui.onRestart());

  instance = ui;
  return ui;
}
