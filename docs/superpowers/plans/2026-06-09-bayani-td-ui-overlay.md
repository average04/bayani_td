# Bayani TD — UI Overlay (Wood & Parchment) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the plain Phaser-text HUD with a styled HTML/CSS overlay (Style A) — top HUD bar, clickable build menu, start-wave button, hero tooltip, win/lose panel — driven by a tested view-model.

**Architecture:** A DOM UI layer wraps the Phaser canvas inside `#game` (HUD above, build menu below, an absolute overlay over the canvas for the start button / tooltip / end panel). A pure `buildUiState` view-model is the tested seam; `GameScene` pushes it each frame and receives intent callbacks. Game logic is untouched. Art is ChatGPT-generated and drops into `public/assets/ui/`; the UI ships looking right on CSS alone.

**Tech Stack:** TypeScript (strict), Phaser 3 (canvas only), HTML/CSS overlay, Vite, Vitest.

**Reference spec:** `docs/superpowers/specs/2026-06-09-bayani-td-ui-overlay-design.md`

---

## File Structure

- `src/ui/uiState.ts` (new) — `WorldLike`, `HeroVM`, `UiState`, `canAfford`, `buildUiState` (pure, tested)
- `src/ui/index.ts` (new) — `createUI(mount)`, `getUI()`, the DOM build + `update(vm)` + intent callbacks
- `src/ui/ui.css` (new) — Style A styling (ships as the placeholder look; real art layers on via `background-image`)
- `src/game/config/heroes.ts` (modify) — export `HERO_ORDER`
- `src/main.ts` (modify) — import the CSS, `createUI`, Phaser `parent: 'stage'`
- `index.html` (modify) — `#game` as a column wrapper
- `src/scenes/GameScene.ts` (modify) — push the view-model to the UI; remove the old text HUD
- `tests/ui/uiState.test.ts` (new)
- Follow-up (not code): ChatGPT art into `public/assets/ui/`

---

## Task 1: View-model (`buildUiState`)

**Files:** Create `src/ui/uiState.ts`; Test `tests/ui/uiState.test.ts`

- [ ] **Step 1: Write the failing test** `tests/ui/uiState.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildUiState, canAfford } from '../../src/ui/uiState';
import type { HeroType } from '../../src/game/config/heroes';

const heroTypes: Record<string, HeroType> = {
  a: { id: 'a', name: 'A', cost: 100, range: 1, damage: 1, fireRate: 1 },
  b: { id: 'b', name: 'B', cost: 50, range: 1, damage: 1, fireRate: 1 },
};
const order = ['a', 'b'];
const world = {
  lives: 20,
  gold: 75,
  waveNumber: 2,
  totalWaves: 6,
  status: 'playing' as const,
  canStartNextWave: () => true,
};

describe('uiState', () => {
  it('canAfford compares gold to cost', () => {
    expect(canAfford(75, 50)).toBe(true);
    expect(canAfford(40, 50)).toBe(false);
  });

  it('builds a view-model with stats and per-hero affordability/selection', () => {
    const vm = buildUiState(world, 'b', 3, order, heroTypes);
    expect(vm.lives).toBe(20);
    expect(vm.gold).toBe(75);
    expect(vm.wave).toBe(2);
    expect(vm.totalWaves).toBe(6);
    expect(vm.bestWave).toBe(3);
    expect(vm.status).toBe('playing');
    expect(vm.canStartWave).toBe(true);
    expect(vm.heroes).toEqual([
      { id: 'a', name: 'A', cost: 100, affordable: false, selected: false },
      { id: 'b', name: 'B', cost: 50, affordable: true, selected: true },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/uiState.test.ts`
Expected: FAIL — cannot resolve `uiState`.

- [ ] **Step 3: Write the implementation** `src/ui/uiState.ts`:

```ts
import type { HeroType } from '../game/config/heroes';
import type { GameStatus } from '../game/state/gameState';

export interface WorldLike {
  lives: number;
  gold: number;
  waveNumber: number;
  totalWaves: number;
  status: GameStatus;
  canStartNextWave(): boolean;
}

export interface HeroVM {
  id: string;
  name: string;
  cost: number;
  affordable: boolean;
  selected: boolean;
}

export interface UiState {
  lives: number;
  gold: number;
  wave: number;
  totalWaves: number;
  status: GameStatus;
  bestWave: number;
  canStartWave: boolean;
  selectedHeroId: string;
  heroes: HeroVM[];
}

export function canAfford(gold: number, cost: number): boolean {
  return gold >= cost;
}

export function buildUiState(
  world: WorldLike,
  selectedHeroId: string,
  bestWave: number,
  heroOrder: string[],
  heroTypes: Record<string, HeroType>,
): UiState {
  return {
    lives: world.lives,
    gold: world.gold,
    wave: world.waveNumber,
    totalWaves: world.totalWaves,
    status: world.status,
    bestWave,
    canStartWave: world.canStartNextWave(),
    selectedHeroId,
    heroes: heroOrder.map((id) => {
      const h = heroTypes[id];
      return {
        id,
        name: h.name,
        cost: h.cost,
        affordable: canAfford(world.gold, h.cost),
        selected: id === selectedHeroId,
      };
    }),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/uiState.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ui/uiState.ts tests/ui/uiState.test.ts
git commit -m "feat: add buildUiState view-model for the UI overlay"
```

---

## Task 2: The UI overlay module (DOM + CSS)

Self-contained: builds the DOM, styles it (Style A placeholder look), exposes `update(vm)` + intent callbacks. Not wired to GameScene yet (Task 3) — the module is verified by `tsc`/`build`.

**Files:** Modify `src/game/config/heroes.ts`, `index.html`, `src/main.ts`; Create `src/ui/index.ts`, `src/ui/ui.css`

- [ ] **Step 1: Export `HERO_ORDER` from `src/game/config/heroes.ts`** — add at the end of the file:

```ts
export const HERO_ORDER = ['lapulapu', 'gabriela', 'bernardo', 'diwata', 'mangkukulam'];
```

- [ ] **Step 2: Create `src/ui/index.ts`**

```ts
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
```

- [ ] **Step 3: Create `src/ui/ui.css`** (Style A — placeholder look; real art layers on via `background-image`)

```css
#game {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-family: 'Trebuchet MS', system-ui, sans-serif;
  user-select: none;
}

/* ---- top HUD bar ---- */
.ui-top {
  width: 768px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 22px;
  padding: 10px 16px;
  color: #f6e6bd;
  text-shadow: 0 1px 0 #2c1f0f;
  background: linear-gradient(#7d5d34, #5c4324);
  border: 3px solid #3a2914;
  border-bottom: none;
  border-radius: 10px 10px 0 0;
}
.ui-stat { display: flex; align-items: center; gap: 8px; }
.ui-stat.ui-wave { margin-left: auto; }
.ui-lab { display: block; font-size: 10px; letter-spacing: 1px; text-transform: uppercase; opacity: .7; }
.ui-statval b { font-size: 17px; font-weight: 800; }
.ui-ico {
  width: 24px; height: 24px; border-radius: 5px;
  background: #caa24a33; border: 1.5px solid #bd9358;
  background-size: cover; background-position: center;
}

/* ---- stage + overlay ---- */
.ui-stage { position: relative; width: 768px; height: 480px; border-left: 3px solid #3a2914; border-right: 3px solid #3a2914; }
.ui-stage canvas { display: block; }
/* z-index keeps the overlay above the Phaser canvas, which is injected into #stage
   after createUI runs (later DOM order would otherwise paint over it). */
.ui-overlay { position: absolute; inset: 0; pointer-events: none; z-index: 10; }

.ui-start {
  position: absolute; right: 12px; bottom: 12px; pointer-events: auto;
  padding: 10px 18px; color: #f8eccb; font-weight: 800; letter-spacing: .5px; cursor: pointer;
  background: linear-gradient(#caa24a, #a9802f); border: 2px solid #3a2914; border-radius: 8px;
  box-shadow: 0 3px 0 #5c4012, inset 0 1px 0 #f0d999;
}
.ui-start:disabled { filter: grayscale(.6) brightness(.7); cursor: default; box-shadow: none; }

.ui-tooltip {
  position: absolute; left: 12px; bottom: 12px; width: 180px; pointer-events: none;
  background: #e7d4a4; border: 2px solid #3a2914; border-radius: 8px; padding: 8px 10px;
  color: #4a3719; font-size: 12px; box-shadow: 0 6px 14px rgba(0,0,0,.4);
}
.ui-tooltip h4 { margin: 0 0 5px; font-size: 13px; color: #5c3d12; }
.ui-trow { display: flex; justify-content: space-between; margin-top: 2px; }

.ui-end {
  position: absolute; inset: 0; pointer-events: auto;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
  background: rgba(20, 14, 6, .55);
}
.ui-end-title { margin: 0; font-size: 40px; letter-spacing: 2px; color: #f6e6bd; text-shadow: 0 2px 0 #2c1f0f; }
.ui-end-title.won { color: #ffd76a; }
.ui-end-title.lost { color: #e07a5f; }
.ui-end-sub { margin: 0; color: #e7d4a4; }
.ui-restart {
  margin-top: 8px; padding: 10px 22px; cursor: pointer; color: #f8eccb; font-weight: 800; letter-spacing: .5px;
  background: linear-gradient(#caa24a, #a9802f); border: 2px solid #3a2914; border-radius: 8px;
  box-shadow: 0 3px 0 #5c4012, inset 0 1px 0 #f0d999;
}

/* ---- build menu ---- */
.ui-bottom {
  width: 768px;
  box-sizing: border-box;
  display: flex;
  gap: 8px;
  padding: 12px;
  background: #e7d4a4;
  background-image: linear-gradient(rgba(120,80,30,.05) 1px, transparent 1px);
  background-size: 100% 7px;
  border: 3px solid #3a2914;
  border-top: none;
  border-radius: 0 0 10px 10px;
}
.ui-tile {
  flex: 1; text-align: center; padding: 9px 4px; cursor: pointer;
  color: #f8eccb; font-weight: 700; font-size: 12.5px; line-height: 1.25;
  background: linear-gradient(#8a6736, #694e29); border: 2px solid #3a2914; border-radius: 8px;
  box-shadow: inset 0 1px 0 #bd9358, 0 2px 0 #2c1f0f;
}
.ui-portrait {
  display: block; width: 34px; height: 34px; margin: 0 auto 4px; border-radius: 6px;
  background: #caa24a33; border: 1.5px solid #bd9358; background-size: cover; background-position: center;
}
.ui-tcost { display: block; font-weight: 700; font-size: 11px; margin-top: 3px; color: #ffe9b0; }
.ui-tkey { display: block; font-size: 9px; opacity: .7; margin-top: 2px; }
.ui-tile.sel { outline: 3px solid #d4af37; outline-offset: 1px; background: linear-gradient(#a07c3e, #7d5d34); }
.ui-tile.poor { filter: grayscale(.6) brightness(.7); cursor: not-allowed; }
```

- [ ] **Step 4: Update `index.html`** — keep the wrapper; the UI module fills it. Replace the `<style>` and `<body>` so `#game` is just the wrapper:

```html
    <style>
      html, body { margin: 0; min-height: 100%; background: #0d140e; }
      body { display: flex; justify-content: center; padding: 16px 0; }
    </style>
  </head>
  <body>
    <div id="game"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
```

- [ ] **Step 5: Update `src/main.ts`** — import the CSS, build the UI before the game, mount Phaser in `'stage'`:

```ts
import './ui/ui.css';
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { GameScene } from './scenes/GameScene';
import { LEVEL_ONE } from './game/config/levels';
import { createUI } from './ui';

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

new Phaser.Game(config);
```

- [ ] **Step 6: Type-check + build**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: no type errors; all 53 tests pass; build clean.

- [ ] **Step 7: Commit**

```bash
git add src/ui/index.ts src/ui/ui.css src/game/config/heroes.ts index.html src/main.ts
git commit -m "feat: add wood-and-parchment UI overlay module"
```

---

## Task 3: Wire the UI into GameScene

Drive the UI from game state each frame and remove the old Phaser-text HUD.

**Files:** Modify `src/scenes/GameScene.ts`

- [ ] **Step 1: Update imports.** At the top of `src/scenes/GameScene.ts`, change the heroes import and add the UI imports:

```ts
import { HERO_TYPES, HERO_ORDER } from '../game/config/heroes';
```

and add (with the other imports):

```ts
import { getUI } from '../ui';
import { buildUiState } from '../ui/uiState';
```

- [ ] **Step 2: Remove the local `HERO_ORDER` const** (keep `HERO_KEYS`). The two constants above the class become just:

```ts
const HERO_KEYS = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE'];
```

- [ ] **Step 3: Remove the old HUD fields.** Delete the `hudText` and `overlayText` field declarations from the class:

```ts
  // DELETE these two lines:
  private hudText!: Phaser.GameObjects.Text;
  private overlayText!: Phaser.GameObjects.Text;
```

- [ ] **Step 4: In `create()`, delete the `hudText` and `overlayText` creation blocks** (the two `this.hudText = this.add.text(...)` and `this.overlayText = this.add.text(...).setOrigin(0.5).setDepth(10000)` statements). Then, right after the keyboard/pointer handlers (after the `this.input.on('pointerdown', ...)` line), add the UI wiring:

```ts
    const ui = getUI();
    ui.onSelectHero = (id) => {
      this.selectedHeroId = id;
    };
    ui.onStartWave = () => {
      this.world.startNextWave();
    };
    ui.onRestart = () => {
      if (this.world.status !== 'playing') this.scene.restart();
    };
```

- [ ] **Step 5: Replace the `update()` body** so it pushes the view-model instead of calling `updateHud()`:

```ts
  update(_time: number, delta: number): void {
    if (this.world.status === 'playing') {
      this.world.update(delta / 1000);
    }
    this.consumeEvents();
    this.syncViews();
    this.drawHpBars();
    getUI().update(buildUiState(this.world, this.selectedHeroId, this.bestWave, HERO_ORDER, HERO_TYPES));
    this.handleEndState();
  }
```

- [ ] **Step 6: Delete the `updateHud()` method entirely.**

- [ ] **Step 7: Update `handleEndState()`** — keep the save logic, drop the Phaser overlay text. Replace the method with:

```ts
  private handleEndState(): void {
    if (this.world.status === 'playing' || this.endHandled) return;
    this.endHandled = true;
    saveBestWave(this.world.waveNumber);
    this.bestWave = Math.max(this.bestWave, this.world.waveNumber);
  }
```

- [ ] **Step 8: Type-check, test, build**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: no type errors (no remaining references to `hudText`/`overlayText`/`updateHud`); all 53 tests pass; build clean.

- [ ] **Step 9: Manual playtest**

Run `npm run dev`; with the **Chrome window foreground**, confirm: the wood HUD bar shows live lives/gold/wave/best; the parchment build menu highlights the selected hero, dims unaffordable ones, and selecting a tile (or keys 1-5) changes the placed hero; the START WAVE button starts a wave and disables while one runs; hovering a tile shows its tooltip; winning/losing shows the VICTORY/DEFEAT panel with a working RESTART.

- [ ] **Step 10: Commit**

```bash
git add src/scenes/GameScene.ts
git commit -m "feat: drive the HTML UI overlay from GameScene; remove text HUD"
```

---

## Definition of Done

- `npm test` passes (53 tests: 51 + 2 uiState); `npm run build` clean.
- The in-game UI is the styled Style-A overlay (HUD bar, clickable build menu, start button, tooltip, win/lose panel); the old Phaser-text HUD is gone; tower placement still works (clicks pass through the overlay).
- The UI looks right on CSS alone; real art is a drop-in.

## Follow-up (not in this plan)

ChatGPT-generated art into `public/assets/ui/` (`hud-bar`, `build-bar`, 5 `tile-*`, `icon-*`, `btn-start`, `tooltip`, `scroll-victory/defeat`), referenced by the `.ui-*` classes via `background-image` (e.g. `.ui-portrait-bernardo { background-image: url(/assets/ui/tile-bernardo.png); }`). Generation via browser ChatGPT or the OpenAI CLI. Title/main-menu screen is its own slice.
