import { HERO_TYPES, HERO_ORDER, type HeroType } from '../game/config/heroes';
import { LOADOUT_SIZE, isValidLoadout } from '../game/config/loadout';
import { loadSave, saveLoadout } from '../services/localSave';
import { playSfx } from '../audio/sfx';

export interface HeroSelectCallbacks {
  onStart: (loadout: string[]) => void;
}

function effectLine(h: HeroType): string {
  if (h.spin) return 'Melee spin (AoE)';
  if (h.splashRadius) return `Splash r${h.splashRadius}`;
  if (h.slow) return `Slow x${h.slow.factor} / ${h.slow.duration}s`;
  if (h.poison) return `Poison ${h.poison.dps}/s / ${h.poison.duration}s`;
  if (h.aura) return `Support · Inspires +${Math.round(h.aura.damageAmp * 100)}% dmg`;
  if (h.mobile) return h.burnAura ? `Roaming · Burn ${h.burnAura.dps}/s` : 'Roaming melee';
  if (h.pierce) return 'Armor-piercing';
  return 'Single target';
}

// Full-screen card-picker: choose exactly LOADOUT_SIZE heroes to bring into the run.
// `opts.timerS` (multiplayer) auto-fills the remaining slots and starts when it expires.
export function showHeroSelect(cb: HeroSelectCallbacks, opts?: { timerS?: number }): void {
  const saved = loadSave().loadout;
  const selected = new Set<string>(saved ?? HERO_ORDER.slice(0, LOADOUT_SIZE));

  const root = document.createElement('div');
  root.className = 'ui-select';
  // the inner wrapper centers via margin:auto, which degrades to scrolling (not clipping)
  // when the viewport is shorter than the content
  root.innerHTML = `
    <div class="ui-select-inner">
      <h1 class="ui-select-title">Choose your Bayani</h1>
      <p class="ui-select-sub">Bring <b>${LOADOUT_SIZE}</b> hero cards into battle</p>
      <div class="ui-select-timer" style="display:none"></div>
      <div class="ui-select-grid"></div>
      <div class="ui-select-foot">
        <span class="ui-select-count"></span>
        <button class="ui-select-start">TO BATTLE</button>
      </div>
    </div>
  `;
  const grid = root.querySelector<HTMLElement>('.ui-select-grid')!;
  const countEl = root.querySelector<HTMLElement>('.ui-select-count')!;
  const startBtn = root.querySelector<HTMLButtonElement>('.ui-select-start')!;
  const timerEl = root.querySelector<HTMLElement>('.ui-select-timer')!;

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
      if (selected.has(id)) {
        selected.delete(id);
        playSfx('cancel');
      } else if (selected.size < LOADOUT_SIZE) {
        selected.add(id);
        playSfx('arm');
      }
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

  let started = false;
  let countdown: number | null = null;

  const start = (): void => {
    if (started) return;
    const loadout = HERO_ORDER.filter((id) => selected.has(id));
    if (!isValidLoadout(loadout)) return;
    started = true;
    playSfx('count-go');
    if (countdown !== null) window.clearInterval(countdown);
    saveLoadout(loadout);
    root.remove();
    cb.onStart(loadout);
  };

  startBtn.addEventListener('click', start);

  // multiplayer pick timer: when it runs out, top up the loadout and march to battle
  if (opts?.timerS) {
    let remaining = opts.timerS;
    timerEl.style.display = 'block';
    const renderTimer = (): void => {
      timerEl.textContent = `Battle begins in ${remaining}s`;
      timerEl.classList.toggle('urgent', remaining <= 5);
    };
    renderTimer();
    countdown = window.setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        renderTimer();
        return;
      }
      window.clearInterval(countdown!);
      countdown = null;
      for (const id of HERO_ORDER) {
        if (selected.size >= LOADOUT_SIZE) break;
        selected.add(id);
      }
      start();
    }, 1000);
  }

  document.body.appendChild(root);
}
