import { HERO_TYPES, HERO_ORDER, type HeroType } from '../game/config/heroes';
import { LOADOUT_SIZE, isValidLoadout } from '../game/config/loadout';
import { loadSave, saveLoadout } from '../services/localSave';

export interface HeroSelectCallbacks {
  onStart: (loadout: string[]) => void;
}

function effectLine(h: HeroType): string {
  if (h.spin) return 'Melee spin (AoE)';
  if (h.splashRadius) return `Splash r${h.splashRadius}`;
  if (h.slow) return `Slow x${h.slow.factor} / ${h.slow.duration}s`;
  if (h.poison) return `Poison ${h.poison.dps}/s / ${h.poison.duration}s`;
  if (h.pierce) return 'Armor-piercing';
  return 'Single target';
}

// Full-screen card-picker: choose exactly LOADOUT_SIZE heroes to bring into the run.
export function showHeroSelect(cb: HeroSelectCallbacks): void {
  const saved = loadSave().loadout;
  const selected = new Set<string>(saved ?? HERO_ORDER.slice(0, LOADOUT_SIZE));

  const root = document.createElement('div');
  root.className = 'ui-select';
  root.innerHTML = `
    <h1 class="ui-select-title">Choose your Bayani</h1>
    <p class="ui-select-sub">Bring <b>${LOADOUT_SIZE}</b> hero cards into battle</p>
    <div class="ui-select-grid"></div>
    <div class="ui-select-foot">
      <span class="ui-select-count"></span>
      <button class="ui-select-start">TO BATTLE</button>
    </div>
  `;
  const grid = root.querySelector<HTMLElement>('.ui-select-grid')!;
  const countEl = root.querySelector<HTMLElement>('.ui-select-count')!;
  const startBtn = root.querySelector<HTMLButtonElement>('.ui-select-start')!;

  const cards = new Map<string, HTMLElement>();
  for (const id of HERO_ORDER) {
    const h = HERO_TYPES[id];
    const card = document.createElement('button');
    card.className = 'ui-card';
    card.innerHTML = `
      <span class="ui-card-art" style="background-image:url(/assets/ui/portrait-${id}.png)"></span>
      <span class="ui-card-name">${h.name}</span>
      <span class="ui-card-cost">$${h.cost}</span>
      <span class="ui-card-trait"><b>${h.trait?.name ?? ''}</b>${h.trait ? ' — ' + h.trait.desc : ''}</span>
      <span class="ui-card-stats">
        <span><i>DMG</i>${h.damage}</span><span><i>RNG</i>${h.range}</span><span><i>SPD</i>${h.fireRate}/s</span>
      </span>
      <span class="ui-card-effect">${effectLine(h)}</span>
      <span class="ui-card-check"></span>
    `;
    card.addEventListener('click', () => {
      if (selected.has(id)) selected.delete(id);
      else if (selected.size < LOADOUT_SIZE) selected.add(id);
      refresh();
    });
    cards.set(id, card);
    grid.appendChild(card);
  }

  function refresh(): void {
    for (const [id, card] of cards) {
      const sel = selected.has(id);
      card.classList.toggle('sel', sel);
      card.classList.toggle('dim', !sel && selected.size >= LOADOUT_SIZE);
    }
    countEl.textContent = `${selected.size} / ${LOADOUT_SIZE} chosen`;
    startBtn.disabled = selected.size !== LOADOUT_SIZE;
  }
  refresh();

  startBtn.addEventListener('click', () => {
    const loadout = HERO_ORDER.filter((id) => selected.has(id));
    if (!isValidLoadout(loadout)) return;
    saveLoadout(loadout);
    root.remove();
    cb.onStart(loadout);
  });

  document.body.appendChild(root);
}
