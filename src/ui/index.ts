import { HERO_TYPES, type HeroType } from '../game/config/heroes';
import { getLoadout } from '../game/config/loadout';
import { STORE } from '../game/config/store';
import { LEVEL_ONE } from '../game/config/levels';
import { getSession } from '../net/session';
import type { UiState, UpgradePanelVM, StorePanelVM } from './uiState';

export interface UI {
  update(vm: UiState): void;
  setUpgradePanel(vm: UpgradePanelVM | null): void;
  setStorePanel(vm: StorePanelVM | null): void;
  onSelectHero: (id: string) => void;
  onRestart: () => void;
  onHome: () => void;
  onUpgrade: (path: number) => void;
  onSell: () => void;
  onSellStore: () => void;
  onUpgradeStore: (path: number) => void;
  onCycleTarget: () => void;
  onSend: (enemyTypeId: string) => void;
  onConcede: () => void;
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
  if (h.spin) return 'Melee spin (AoE)';
  if (h.splashRadius) return `Splash r${h.splashRadius}`;
  if (h.slow) return `Slow x${h.slow.factor} / ${h.slow.duration}s`;
  if (h.poison) return `Poison ${h.poison.dps}/s / ${h.poison.duration}s`;
  if (h.aura) return `Inspires +${Math.round(h.aura.damageAmp * 100)}% dmg`;
  if (h.mobile) return h.burnAura ? `Roaming · Burn ${h.burnAura.dps}/s` : 'Roaming melee';
  if (h.pierce) return 'Armor-piercing';
  return 'Single target';
}

export function createUI(mount: HTMLElement): UI {
  mount.innerHTML = '';

  // layout: [details sidebar] [HUD / stage / build bar] [rival + send sidebar (MP)]
  // — panels live BESIDE the map, never over it
  const left = el('div', 'ui-left', mount);
  const col = el('div', 'ui-col', mount);

  // top HUD bar
  const top = el('div', 'ui-top', col);
  const statValue = (icon: string, label: string): HTMLElement => {
    const s = el('div', 'ui-stat', top);
    el('span', `ui-ico ui-ico-${icon}`, s);
    const box = el('div', 'ui-statval', s);
    el('span', 'ui-lab', box).textContent = label;
    return el('b', '', box);
  };
  const livesV = statValue('lives', 'Lives');
  const goldV = statValue('gold', 'Gold');
  const passiveV = el('span', 'ui-passive', goldV.parentElement as HTMLElement);
  const waveStat = el('div', 'ui-stat ui-wave', top);
  el('span', 'ui-ico ui-ico-wave', waveStat);
  const waveBox = el('div', 'ui-statval', waveStat);
  el('span', 'ui-lab', waveBox).textContent = 'Wave';
  const waveV = el('b', '', waveBox);
  const bestStat = el('div', 'ui-stat', top);
  const bestBox = el('div', 'ui-statval', bestStat);
  el('span', 'ui-lab', bestBox).textContent = 'Best';
  const bestV = el('b', '', bestBox);

  const oppStat = el('div', 'ui-stat ui-opp', top);
  oppStat.style.display = 'none';
  const oppBox = el('div', 'ui-statval', oppStat);
  el('span', 'ui-lab', oppBox).textContent = 'Rival';
  const oppV = el('b', '', oppBox);

  // stage (Phaser mounts here) + overlay; double-wide in MP for the side-by-side boards
  const mpMode = getSession() !== null;
  const boardW = LEVEL_ONE.cols * LEVEL_ONE.tileSize;
  const stage = el('div', 'ui-stage', col);
  stage.id = 'stage';
  stage.style.width = `${mpMode ? boardW * 2 + 48 : boardW}px`;
  const overlay = el('div', 'ui-overlay', stage);

  const nextWave = el('div', 'ui-nextwave', overlay);
  nextWave.style.display = 'none';

  // boss banner, shown while a boss is on the field
  const bossBanner = el('div', 'ui-boss', overlay);
  bossBanner.textContent = 'BAKUNAWA RISES';
  bossBanner.style.display = 'none';

  const sendBtns = new Map<string, HTMLButtonElement>();

  const tooltip = el('div', 'ui-tooltip', left);
  tooltip.style.display = 'none';

  // banner shown while a hero is armed for deployment
  const deploy = el('div', 'ui-deploy', overlay);
  deploy.style.display = 'none';

  // upgrade panel (shown when a placed tower is selected)
  const upg = el('div', 'ui-upg', left);
  upg.style.display = 'none';
  const upgName = el('div', 'ui-upg-name', upg);
  const upgStat: Record<string, HTMLElement> = {};
  const mkStat = (label: string, key: string): void => {
    const row = el('div', 'ui-upg-srow', upg);
    el('span', 'ui-upg-slabel', row).textContent = label;
    upgStat[key] = el('span', 'ui-upg-sval', row);
  };
  mkStat('Damage', 'damage');
  mkStat('Range', 'range');
  mkStat('Atk Speed', 'speed');
  mkStat('Effect', 'effect');
  const upgTarget = el<HTMLButtonElement>('button', 'ui-upg-target', upg);
  upgTarget.addEventListener('click', () => ui.onCycleTarget());
  const upgPathName: HTMLElement[] = [];
  const upgPips: HTMLElement[][] = [];
  const upgBtns: HTMLButtonElement[] = [];
  const upgDesc: HTMLElement[] = [];
  for (let p = 0; p < 2; p++) {
    const row = el('div', 'ui-upg-path', upg);
    const head = el('div', 'ui-upg-head', row);
    upgPathName[p] = el('span', 'ui-upg-pname', head);
    const pipBox = el('span', 'ui-upg-pips', head);
    upgPips[p] = [];
    for (let i = 0; i < 4; i++) upgPips[p].push(el('span', 'ui-pip', pipBox));
    const btn = el<HTMLButtonElement>('button', 'ui-upg-btn', row);
    const path = p;
    btn.addEventListener('click', () => ui.onUpgrade(path));
    upgBtns[p] = btn;
    upgDesc[p] = el('div', 'ui-upg-desc', row);
  }
  const upgSell = el<HTMLButtonElement>('button', 'ui-upg-sell', upg);
  upgSell.addEventListener('click', () => ui.onSell());

  // store info + upgrade panel (shown when a placed store is selected)
  const storePanel = el('div', 'ui-store', left);
  storePanel.style.display = 'none';
  const storeName = el('div', 'ui-upg-name', storePanel);
  const storeIncome = el('div', 'ui-store-income', storePanel);
  const storePathName: HTMLElement[] = [];
  const storePips: HTMLElement[][] = [];
  const storeBtns: HTMLButtonElement[] = [];
  const storeDesc: HTMLElement[] = [];
  for (let p = 0; p < 2; p++) {
    const row = el('div', 'ui-upg-path', storePanel);
    const head = el('div', 'ui-upg-head', row);
    storePathName[p] = el('span', 'ui-upg-pname', head);
    const pipBox = el('span', 'ui-upg-pips', head);
    storePips[p] = [];
    for (let i = 0; i < 4; i++) storePips[p].push(el('span', 'ui-pip', pipBox));
    const btn = el<HTMLButtonElement>('button', 'ui-upg-btn', row);
    const path = p;
    btn.addEventListener('click', () => ui.onUpgradeStore(path));
    storeBtns[p] = btn;
    storeDesc[p] = el('div', 'ui-upg-desc', row);
  }
  const storeSell = el<HTMLButtonElement>('button', 'ui-upg-sell', storePanel);
  storeSell.addEventListener('click', () => ui.onSellStore());

  const endPanel = el('div', 'ui-end', overlay);
  endPanel.style.display = 'none';
  const endTitle = el('h2', 'ui-end-title', endPanel);
  const endSub = el('p', 'ui-end-sub', endPanel);
  const endBtns = el('div', 'ui-end-btns', endPanel);
  const restartBtn = el<HTMLButtonElement>('button', 'ui-restart', endBtns);
  restartBtn.textContent = 'RESTART';
  const homeBtn = el<HTMLButtonElement>('button', 'ui-restart ui-homebtn', endBtns);
  homeBtn.textContent = 'HOME';

  // build menu: hero cards + store under OUR board; in MP the monster send menu
  // sits beside them, under the RIVAL's board (you send monsters at THEM)
  const loadout = getLoadout();
  const bottom = el('div', 'ui-bottom', col);
  const buildBox = el('div', 'ui-bottom-build', bottom);
  buildBox.style.width = mpMode ? `${boardW - 24}px` : '100%';
  let sendBox: HTMLElement | null = null;
  let concedeBtn: HTMLButtonElement | null = null;
  if (mpMode) {
    const sendsWrap = el('div', 'ui-bottom-sends', bottom);
    el('div', 'ui-sends-title', sendsWrap).textContent = 'SEND MONSTERS';
    sendBox = el('div', 'ui-sends-grid', sendsWrap);
    concedeBtn = el<HTMLButtonElement>('button', 'ui-sends-concede', sendsWrap);
    concedeBtn.textContent = 'CONCEDE';
    concedeBtn.addEventListener('click', () => ui.onConcede());
  }
  const tiles: Record<string, HTMLElement> = {};
  loadout.forEach((id, i) => {
    const h = HERO_TYPES[id];
    const tile = el('div', `ui-tile ui-tile-${id}`, buildBox);
    el('span', `ui-portrait ui-portrait-${id}`, tile);
    el('div', 'ui-tname', tile).textContent = h.name;
    el('small', 'ui-tcost', tile).textContent = `$${h.cost}`;
    el('span', 'ui-tkey', tile).textContent = `[${i + 1}]`;
    tile.addEventListener('click', () => ui.onSelectHero(id));
    tile.addEventListener('mouseenter', () => {
      tooltip.innerHTML =
        `<h4>${h.name}</h4>` +
        (h.trait ? `<div class="ui-ttrait"><b>${h.trait.name}</b> — ${h.trait.desc}</div>` : '') +
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

  // sari-sari store (economy) build tile
  const storeTile = el('div', 'ui-tile ui-tile-store', buildBox);
  el('span', 'ui-portrait ui-portrait-store', storeTile);
  el('div', 'ui-tname', storeTile).textContent = STORE.name;
  const storeCost = el('small', 'ui-tcost', storeTile);
  storeCost.textContent = `$${STORE.cost}`;
  el('span', 'ui-tkey', storeTile).textContent = `[${loadout.length + 1}]`;
  storeTile.addEventListener('click', () => ui.onSelectHero(STORE.id));
  storeTile.addEventListener('mouseenter', () => {
    tooltip.innerHTML =
      `<h4>${STORE.name}</h4>` +
      `<div class="ui-trow"><span>Income</span><b>+${STORE.incomeAmount}g / ${STORE.incomeInterval}s</b></div>` +
      `<div class="ui-trow"><span>Cost</span><b>$${STORE.cost}</b></div>` +
      `<div class="ui-trow"><span>Limit</span><b>${STORE.maxCount} per game</b></div>`;
    tooltip.style.display = 'block';
  });
  storeTile.addEventListener('mouseleave', () => {
    tooltip.style.display = 'none';
  });

  const ui: UI = {
    onSelectHero: () => {},
    onRestart: () => {},
    onHome: () => {},
    onUpgrade: () => {},
    onSell: () => {},
    onSellStore: () => {},
    onUpgradeStore: () => {},
    onCycleTarget: () => {},
    onSend: () => {},
    onConcede: () => {},
    setStorePanel(vm: StorePanelVM | null): void {
      if (!vm) {
        storePanel.style.display = 'none';
        return;
      }
      storePanel.style.display = 'block';
      storeName.textContent = vm.name;
      storeIncome.textContent = vm.income;
      storeSell.textContent = `Sell — $${vm.sellValue}`;
      vm.paths.forEach((pv, p) => {
        storePathName[p].textContent = pv.name;
        storePips[p].forEach((dot, i) => dot.classList.toggle('on', i < pv.level));
        const btn = storeBtns[p];
        if (!pv.next) {
          btn.textContent = 'MAX';
          btn.disabled = true;
        } else {
          btn.textContent = `${pv.next.name} — $${pv.next.cost}`;
          btn.disabled = !pv.canBuy;
        }
        btn.classList.toggle('locked', pv.locked);
        storeDesc[p].textContent = pv.next ? pv.next.desc : '';
      });
    },
    setUpgradePanel(vm: UpgradePanelVM | null): void {
      if (!vm) {
        upg.style.display = 'none';
        return;
      }
      upg.style.display = 'block';
      upgName.textContent = vm.heroName;
      upgStat.damage.textContent = String(vm.stats.damage);
      upgStat.range.textContent = String(vm.stats.range);
      upgStat.speed.textContent = `${+vm.stats.fireRate.toFixed(2)}/s`;
      upgStat.effect.textContent = vm.stats.effect;
      upgSell.textContent = `Sell — $${vm.sellValue}`;
      if (vm.targetMode) {
        upgTarget.style.display = 'block';
        upgTarget.textContent = `Target: ${vm.targetMode[0].toUpperCase()}${vm.targetMode.slice(1)}`;
      } else {
        upgTarget.style.display = 'none';
      }
      vm.paths.forEach((pv, p) => {
        upgPathName[p].textContent = pv.name;
        upgPips[p].forEach((dot, i) => dot.classList.toggle('on', i < pv.level));
        const btn = upgBtns[p];
        if (!pv.next) {
          btn.textContent = 'MAX';
          btn.disabled = true;
        } else {
          btn.textContent = `${pv.next.name} — $${pv.next.cost}`;
          btn.disabled = !pv.canBuy;
        }
        btn.classList.toggle('locked', pv.locked);
        upgDesc[p].textContent = pv.next ? pv.next.desc : '';
      });
    },
    update(vm: UiState): void {
      livesV.textContent = String(vm.lives);
      goldV.textContent = String(vm.gold);
      passiveV.textContent = vm.passiveIncome > 0 ? `+${+vm.passiveIncome.toFixed(1)}/s` : '';
      waveV.textContent = Number.isFinite(vm.totalWaves) ? `${vm.wave} / ${vm.totalWaves}` : `${vm.wave}`;
      bestV.textContent = String(vm.bestWave);
      if (vm.status === 'playing' && vm.nextWaveIn !== null) {
        nextWave.style.display = 'block';
        nextWave.textContent = `Next wave in ${Math.ceil(vm.nextWaveIn)}…`;
      } else {
        nextWave.style.display = 'none';
      }
      bossBanner.style.display = vm.bossActive ? 'block' : 'none';
      for (const h of vm.heroes) {
        const tile = tiles[h.id];
        tile.classList.toggle('sel', h.selected);
        tile.classList.toggle('poor', !h.affordable);
      }
      storeTile.classList.toggle('sel', vm.selectedHeroId === STORE.id);
      storeTile.classList.toggle('poor', vm.gold < STORE.cost || vm.storeMaxed);
      storeCost.textContent = vm.storeMaxed ? 'MAX' : `$${STORE.cost}`;
      if (vm.status === 'playing' && vm.selectedHeroId) {
        const name = vm.selectedHeroId === STORE.id ? STORE.name : HERO_TYPES[vm.selectedHeroId].name;
        deploy.innerHTML =
          `Deploying: ${name}` +
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
        endSub.textContent = Number.isFinite(vm.totalWaves)
          ? `Reached wave ${vm.wave} / ${vm.totalWaves}`
          : `Reached wave ${vm.wave} · Best ${Math.max(vm.bestWave, vm.wave)}`;
      }
      if (vm.opponent) {
        oppStat.style.display = 'flex';
        oppV.textContent = `${vm.opponent.nickname} · ${vm.opponent.lives} HP · W${vm.opponent.wave}`;
      } else {
        oppStat.style.display = 'none';
      }
      if (vm.sends && sendBox && concedeBtn) {
        for (const s of vm.sends) {
          let btn = sendBtns.get(s.id);
          if (!btn) {
            btn = el<HTMLButtonElement>('button', 'ui-send-btn', sendBox);
            const id = s.id;
            btn.addEventListener('click', () => ui.onSend(id));
            sendBtns.set(s.id, btn);
          }
          btn.textContent = s.unlocked ? `${s.name} $${s.cost}` : `${s.name} — wave ${s.unlockWave}`;
          btn.disabled = vm.status !== 'playing' || !s.unlocked || !s.affordable;
        }
        concedeBtn.disabled = vm.status !== 'playing';
      }
    },
  };
  restartBtn.addEventListener('click', () => ui.onRestart());
  homeBtn.addEventListener('click', () => ui.onHome());

  instance = ui;
  return ui;
}
