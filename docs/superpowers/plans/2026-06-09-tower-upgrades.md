# Tower Upgrades Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let placed towers be upgraded along 2 Bloons-restricted paths (4 levels each), with a click-to-select upgrade panel; Lapu-Lapu's paths authored first.

**Architecture:** A data-driven `upgrades.ts` holds path/level definitions + pure helpers (effective stats, the cross-path rule). `Tower` gains `levels` + an effective `stats` object that combat reads instead of the shared `HeroType`. `World` gains `towerAt`/`canUpgrade`/`upgradeTower`. A pure view-model feeds a DOM upgrade panel; `GameScene` handles tower selection + a range ring.

**Tech Stack:** TypeScript (strict), Phaser 3, Vite, Vitest.

**Reference spec:** `docs/superpowers/specs/2026-06-09-tower-upgrades-design.md`

---

## File Structure

- `src/game/config/upgrades.ts` (new) — types, `UPGRADES`, `baseStats`, `effectiveStats`, `nextUpgrade`, `canUpgradePath`
- `src/game/entities/tower.ts` (modify) — `levels`, `stats`, `upgrade()`; cooldown/range from `stats`
- `src/game/world.ts` (modify) — combat reads `tower.stats`; `towerAt`/`canUpgrade`/`nextUpgradeCost`/`upgradeTower`
- `src/ui/uiState.ts` (modify) — `buildUpgradePanel()` view-model
- `src/ui/index.ts` (modify) — DOM upgrade panel + `setUpgradePanel`/`onUpgrade`
- `src/ui/ui.css` (modify) — panel styles
- `src/scenes/GameScene.ts` (modify) — select a tower, range ring, wire upgrades
- Tests: `tests/game/config/upgrades.test.ts`, `tests/game/ui/upgradePanel.test.ts` (new); extend `tests/game/entities/tower.test.ts`; new `tests/game/world-upgrade.test.ts`

---

## Task 1: Upgrades config + pure logic

**Files:** Create `src/game/config/upgrades.ts`, `tests/game/config/upgrades.test.ts`

- [ ] **Step 1: Write the failing test** `tests/game/config/upgrades.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { effectiveStats, canUpgradePath, nextUpgrade, UPGRADES } from '../../../src/game/config/upgrades';
import { HERO_TYPES } from '../../../src/game/config/heroes';

const lapu = HERO_TYPES.lapulapu;

describe('upgrades', () => {
  it('defines 2 paths of 4 levels for lapulapu', () => {
    expect(UPGRADES.lapulapu).toHaveLength(2);
    expect(UPGRADES.lapulapu[0].levels).toHaveLength(4);
    expect(UPGRADES.lapulapu[1].levels).toHaveLength(4);
  });

  it('effectiveStats applies purchased deltas cumulatively', () => {
    expect(effectiveStats(lapu, [0, 0]).damage).toBe(lapu.damage);
    const a2 = effectiveStats(lapu, [2, 0]);
    expect(a2.damage).toBe(lapu.damage + 12 + 20);
    expect(a2.range).toBe(lapu.range + 10);
    const b4 = effectiveStats(lapu, [0, 4]);
    expect(b4.fireRate).toBeCloseTo(lapu.fireRate + 0.3 + 0.4 + 0.5);
    expect(b4.slow).toEqual({ factor: 0.5, duration: 1.5 });
  });

  it('canUpgradePath enforces the one-path-past-2 rule', () => {
    expect(canUpgradePath([0, 0], 0)).toBe(true);
    expect(canUpgradePath([2, 2], 0)).toBe(true);
    expect(canUpgradePath([2, 3], 0)).toBe(false);
    expect(canUpgradePath([3, 2], 1)).toBe(false);
    expect(canUpgradePath([3, 2], 0)).toBe(true);
    expect(canUpgradePath([4, 2], 0)).toBe(false);
  });

  it('nextUpgrade returns the next level or null', () => {
    expect(nextUpgrade(lapu, [0, 0], 0)?.cost).toBe(60);
    expect(nextUpgrade(lapu, [4, 0], 0)).toBeNull();
    expect(nextUpgrade(HERO_TYPES.gabriela, [0, 0], 0)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/game/config/upgrades.test.ts`
Expected: FAIL — cannot resolve `upgrades`.

- [ ] **Step 3: Create `src/game/config/upgrades.ts`**

```ts
import type { HeroType } from './heroes';

export interface TowerStats {
  damage: number;
  range: number;
  fireRate: number;
  splashRadius?: number;
  slow?: { factor: number; duration: number };
  poison?: { dps: number; duration: number };
  spin?: boolean;
}

export interface StatDelta {
  damage?: number; // additive
  range?: number; // additive
  fireRate?: number; // additive
  splashRadius?: number; // additive
  slow?: { factor: number; duration: number }; // set
  poison?: { dps: number; duration: number }; // set
}

export interface UpgradeLevel {
  name: string;
  cost: number;
  desc: string;
  delta: StatDelta;
}

export interface UpgradePath {
  name: string;
  levels: UpgradeLevel[]; // exactly 4
}

export type HeroUpgrades = [UpgradePath, UpgradePath];

export const UPGRADES: Record<string, HeroUpgrades> = {
  lapulapu: [
    {
      name: 'Conqueror',
      levels: [
        { name: 'Sharpened Bolo', cost: 60, desc: '+12 damage', delta: { damage: 12 } },
        { name: "Warrior's Might", cost: 120, desc: '+20 damage, +10 range', delta: { damage: 20, range: 10 } },
        { name: "Datu's Fury", cost: 220, desc: '+35 damage', delta: { damage: 35 } },
        { name: 'Hero of Mactan', cost: 420, desc: '+70 damage, +15 range', delta: { damage: 70, range: 15 } },
      ],
    },
    {
      name: 'Whirlwind',
      levels: [
        { name: 'Quick Strikes', cost: 50, desc: '+0.3 attack speed', delta: { fireRate: 0.3 } },
        { name: 'Cyclone', cost: 110, desc: '+0.4 attack speed', delta: { fireRate: 0.4 } },
        { name: 'Dizzying Spin', cost: 190, desc: 'Slow 0.65x / 1s', delta: { slow: { factor: 0.65, duration: 1 } } },
        { name: 'Tempest', cost: 360, desc: '+0.5 atk speed, Slow 0.5x / 1.5s', delta: { fireRate: 0.5, slow: { factor: 0.5, duration: 1.5 } } },
      ],
    },
  ],
};

export function baseStats(hero: HeroType): TowerStats {
  return {
    damage: hero.damage,
    range: hero.range,
    fireRate: hero.fireRate,
    splashRadius: hero.splashRadius,
    slow: hero.slow,
    poison: hero.poison,
    spin: hero.spin,
  };
}

function applyDelta(s: TowerStats, d: StatDelta): void {
  if (d.damage) s.damage += d.damage;
  if (d.range) s.range += d.range;
  if (d.fireRate) s.fireRate += d.fireRate;
  if (d.splashRadius) s.splashRadius = (s.splashRadius ?? 0) + d.splashRadius;
  if (d.slow) s.slow = d.slow;
  if (d.poison) s.poison = d.poison;
}

export function effectiveStats(hero: HeroType, levels: readonly [number, number]): TowerStats {
  const s = baseStats(hero);
  const paths = UPGRADES[hero.id];
  if (!paths) return s;
  for (let p = 0; p < 2; p++) {
    for (let lvl = 1; lvl <= levels[p]; lvl++) applyDelta(s, paths[p].levels[lvl - 1].delta);
  }
  return s;
}

export function nextUpgrade(hero: HeroType, levels: readonly [number, number], path: number): UpgradeLevel | null {
  const paths = UPGRADES[hero.id];
  if (!paths) return null;
  const cur = levels[path];
  if (cur >= 4) return null;
  return paths[path].levels[cur];
}

// Bloons-style: a path may pass level 2 only while the other path stays <= 2.
export function canUpgradePath(levels: readonly [number, number], path: number): boolean {
  const cur = levels[path];
  if (cur >= 4) return false;
  const other = levels[path === 0 ? 1 : 0];
  if (cur + 1 >= 3 && other > 2) return false;
  return true;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/game/config/upgrades.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/game/config/upgrades.ts tests/game/config/upgrades.test.ts
git commit -m "feat: tower upgrade config + stat/rule helpers"
```

---

## Task 2: Tower upgrade state + effective stats

**Files:** Modify `src/game/entities/tower.ts`; extend `tests/game/entities/tower.test.ts`

- [ ] **Step 1: Append a failing test** to `tests/game/entities/tower.test.ts` (keep the existing tests; add `Tower` + `HERO_TYPES` to imports if not present):

```ts
import { HERO_TYPES } from '../../../src/game/config/heroes';

describe('Tower upgrades', () => {
  it('starts at level [0,0] with base stats', () => {
    const t = new Tower(HERO_TYPES.lapulapu, { x: 0, y: 0 });
    expect(t.levels).toEqual([0, 0]);
    expect(t.stats.damage).toBe(HERO_TYPES.lapulapu.damage);
  });

  it('upgrading a path bumps the level and recomputes stats', () => {
    const t = new Tower(HERO_TYPES.lapulapu, { x: 0, y: 0 });
    t.upgrade(0); // Path A L1: +12 damage
    expect(t.levels).toEqual([1, 0]);
    expect(t.stats.damage).toBe(HERO_TYPES.lapulapu.damage + 12);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/game/entities/tower.test.ts`
Expected: FAIL — `levels`/`stats`/`upgrade` do not exist.

- [ ] **Step 3: Rewrite `src/game/entities/tower.ts`**

```ts
import type { HeroType } from '../config/heroes';
import { baseStats, effectiveStats, type TowerStats } from '../config/upgrades';
import { distance, type Vec2 } from '../geometry';

export class Tower {
  readonly type: HeroType;
  readonly pos: Vec2;
  cooldown: number; // seconds remaining until it can fire
  levels: [number, number] = [0, 0];
  stats: TowerStats;

  constructor(type: HeroType, pos: Vec2) {
    this.type = type;
    this.pos = pos;
    this.cooldown = 0;
    this.stats = baseStats(type);
  }

  upgrade(path: number): void {
    this.levels[path] += 1;
    this.stats = effectiveStats(this.type, this.levels);
  }

  update(dt: number): void {
    this.cooldown = Math.max(0, this.cooldown - dt);
  }

  get canFire(): boolean {
    return this.cooldown <= 0;
  }

  resetCooldown(): void {
    this.cooldown = 1 / this.stats.fireRate;
  }

  inRange(target: Vec2): boolean {
    return distance(this.pos, target) <= this.stats.range;
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/game/entities/tower.test.ts`
Expected: PASS (existing tests + 2 new).

- [ ] **Step 5: Commit**

```bash
git add src/game/entities/tower.ts tests/game/entities/tower.test.ts
git commit -m "feat: Tower tracks upgrade levels and effective stats"
```

---

## Task 3: World combat reads stats + upgrade/select API

**Files:** Modify `src/game/world.ts`; Create `tests/game/world-upgrade.test.ts`

- [ ] **Step 1: Write the failing test** `tests/game/world-upgrade.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { World, type WorldConfig } from '../../src/game/world';
import type { LevelConfig } from '../../src/game/config/levels';
import { HERO_TYPES } from '../../src/game/config/heroes';

const level: LevelConfig = {
  id: 't', name: 'T', tileSize: 48, cols: 16, rows: 10, cellSize: 24,
  path: [{ x: 0, y: 0 }, { x: 700, y: 0 }],
  startingGold: 1000, startingLives: 20,
};
const cfg = (gold = 1000): WorldConfig => ({ level: { ...level, startingGold: gold }, enemyTypes: {}, heroTypes: HERO_TYPES, waves: [] });

describe('World upgrades', () => {
  it('finds the tower under a point via its footprint', () => {
    const w = new World(cfg());
    w.placeTower('lapulapu', 4, 4); // footprint center (120,120)
    expect(w.towerAt(120, 120)).toBe(w.towers[0]);
    expect(w.towerAt(144, 120)).toBe(w.towers[0]); // footprint edge
    expect(w.towerAt(300, 300)).toBeNull();
  });

  it('upgrades a path, spends gold, and applies stats', () => {
    const w = new World(cfg());
    w.placeTower('lapulapu', 4, 4); // -100 -> 900
    const t = w.towers[0];
    expect(w.upgradeTower(t, 0)).toBe(true); // Path A L1 cost 60
    expect(w.gold).toBe(900 - 60);
    expect(t.levels).toEqual([1, 0]);
    expect(t.stats.damage).toBe(HERO_TYPES.lapulapu.damage + 12);
  });

  it('enforces the cross-path lock', () => {
    const w = new World(cfg());
    w.placeTower('lapulapu', 4, 4);
    const t = w.towers[0];
    t.upgrade(0); t.upgrade(0); t.upgrade(0); // A=3
    t.upgrade(1); t.upgrade(1); // B=2
    expect(w.canUpgrade(t, 1)).toBe(false); // B can't reach 3 while A>2
    expect(w.canUpgrade(t, 0)).toBe(true); // A keeps going to 4
  });

  it('refuses an unaffordable upgrade', () => {
    const w = new World(cfg(100));
    w.placeTower('lapulapu', 4, 4); // -100 -> 0
    const t = w.towers[0];
    expect(w.upgradeTower(t, 0)).toBe(false);
    expect(t.levels).toEqual([0, 0]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/game/world-upgrade.test.ts`
Expected: FAIL — `towerAt`/`canUpgrade`/`upgradeTower` do not exist.

- [ ] **Step 3: Edit `src/game/world.ts` imports** — add:

```ts
import { canUpgradePath, nextUpgrade, type TowerStats } from './config/upgrades';
```

- [ ] **Step 4: Replace the `applyHit` method** in `src/game/world.ts` (it currently takes a `HeroType`) with a stats-based version:

```ts
  private applyHit(affected: Enemy[], stats: TowerStats): void {
    for (const e of affected) {
      e.takeDamage(stats.damage);
      if (stats.slow) e.applySlow(stats.slow.factor, stats.slow.duration);
      if (stats.poison) e.applyPoison(stats.poison.dps, stats.poison.duration);
    }
  }
```

- [ ] **Step 5: Replace the fire-step loop** (the `// 3. towers fire` block) in `src/game/world.ts` with the stats-based version:

```ts
    // 3. towers fire (reads effective, upgraded stats)
    for (const t of this.towers) {
      t.update(dt);
      if (!t.canFire) continue;
      const s = t.stats;
      if (s.spin) {
        const affected = this.enemies.filter(
          (e) => !e.isDead && !e.reachedEnd && distance(e.pos, t.pos) <= s.range,
        );
        if (affected.length === 0) continue;
        this.applyHit(affected, s);
        t.resetCooldown();
        this.events.shots.push({
          from: { x: t.pos.x, y: t.pos.y },
          to: { x: t.pos.x, y: t.pos.y }, // self-centered: from === to marks a spin
          heroId: t.type.id,
        });
      } else {
        const target = selectTarget(t, this.enemies);
        if (!target) continue;
        const affected = s.splashRadius
          ? this.enemies.filter(
              (e) => !e.isDead && !e.reachedEnd && distance(e.pos, target.pos) <= s.splashRadius!,
            )
          : [target];
        this.applyHit(affected, s);
        t.resetCooldown();
        this.events.shots.push({
          from: { x: t.pos.x, y: t.pos.y },
          to: { x: target.pos.x, y: target.pos.y },
          heroId: t.type.id,
        });
      }
    }
```

- [ ] **Step 6: Add the upgrade/select methods** to `src/game/world.ts` (right after `placeTower`):

```ts
  towerAt(x: number, y: number): Tower | null {
    const cs = this.level.cellSize;
    for (const t of this.towers) {
      if (Math.abs(x - t.pos.x) <= cs && Math.abs(y - t.pos.y) <= cs) return t;
    }
    return null;
  }

  canUpgrade(tower: Tower, path: number): boolean {
    return nextUpgrade(tower.type, tower.levels, path) !== null && canUpgradePath(tower.levels, path);
  }

  nextUpgradeCost(tower: Tower, path: number): number | null {
    const u = nextUpgrade(tower.type, tower.levels, path);
    return u ? u.cost : null;
  }

  upgradeTower(tower: Tower, path: number): boolean {
    const u = nextUpgrade(tower.type, tower.levels, path);
    if (!u || !canUpgradePath(tower.levels, path)) return false;
    if (!this.economy.spend(u.cost)) return false;
    tower.upgrade(path);
    return true;
  }
```

- [ ] **Step 7: Run tests to verify**

Run: `npx vitest run tests/game/world-upgrade.test.ts tests/game/world-combat.test.ts tests/game/world.test.ts tests/game/world-events.test.ts`
Expected: PASS (the combat suites stay green because un-upgraded `stats` equal the base hero stats).

- [ ] **Step 8: Full check + commit**

Run: `npx tsc --noEmit && npm test`
Expected: clean; all tests pass.

```bash
git add src/game/world.ts tests/game/world-upgrade.test.ts
git commit -m "feat: World reads tower stats and supports select/upgrade"
```

---

## Task 4: Upgrade-panel view-model

**Files:** Modify `src/ui/uiState.ts`; Create `tests/game/ui/upgradePanel.test.ts`

- [ ] **Step 1: Write the failing test** `tests/game/ui/upgradePanel.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildUpgradePanel } from '../../../src/ui/uiState';

describe('buildUpgradePanel', () => {
  it('returns null for a hero with no upgrades', () => {
    expect(buildUpgradePanel('gabriela', [0, 0], 1000)).toBeNull();
  });

  it('describes both paths with the next upgrade and affordability', () => {
    const vm = buildUpgradePanel('lapulapu', [0, 0], 1000)!;
    expect(vm.heroName).toBe('Lapu-Lapu');
    expect(vm.paths[0].name).toBe('Conqueror');
    expect(vm.paths[0].level).toBe(0);
    expect(vm.paths[0].next).toEqual({ name: 'Sharpened Bolo', cost: 60 });
    expect(vm.paths[0].canBuy).toBe(true);
  });

  it('marks an upgrade unaffordable and a rule-locked path', () => {
    const poor = buildUpgradePanel('lapulapu', [0, 0], 10)!;
    expect(poor.paths[0].canBuy).toBe(false); // can't afford 60
    const locked = buildUpgradePanel('lapulapu', [3, 2], 1000)!;
    expect(locked.paths[1].locked).toBe(true); // B can't pass 2 while A is 3
    expect(locked.paths[1].canBuy).toBe(false);
  });

  it('shows a maxed path as next=null', () => {
    const vm = buildUpgradePanel('lapulapu', [4, 2], 1000)!;
    expect(vm.paths[0].next).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/game/ui/upgradePanel.test.ts`
Expected: FAIL — `buildUpgradePanel` not exported.

- [ ] **Step 3: Add to `src/ui/uiState.ts`** — new imports at the top:

```ts
import { UPGRADES, nextUpgrade, canUpgradePath } from '../game/config/upgrades';
import { HERO_TYPES } from '../game/config/heroes';
```

and append at the end of the file:

```ts
export interface UpgradePathVM {
  name: string;
  level: number; // 0-4
  next: { name: string; cost: number } | null;
  locked: boolean; // has a next level but the cross-path rule blocks it
  canBuy: boolean; // rule-allowed AND affordable
}

export interface UpgradePanelVM {
  heroId: string;
  heroName: string;
  paths: [UpgradePathVM, UpgradePathVM];
}

export function buildUpgradePanel(
  heroId: string,
  levels: readonly [number, number],
  gold: number,
): UpgradePanelVM | null {
  const paths = UPGRADES[heroId];
  const hero = HERO_TYPES[heroId];
  if (!paths || !hero) return null;
  const mk = (p: number): UpgradePathVM => {
    const up = nextUpgrade(hero, levels, p);
    const ruleOk = canUpgradePath(levels, p);
    return {
      name: paths[p].name,
      level: levels[p],
      next: up ? { name: up.name, cost: up.cost } : null,
      locked: up !== null && !ruleOk,
      canBuy: up !== null && ruleOk && gold >= up.cost,
    };
  };
  return { heroId, heroName: hero.name, paths: [mk(0), mk(1)] };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/game/ui/upgradePanel.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ui/uiState.ts tests/game/ui/upgradePanel.test.ts
git commit -m "feat: upgrade-panel view-model"
```

---

## Task 5: DOM upgrade panel

**Files:** Modify `src/ui/index.ts`, `src/ui/ui.css`

- [ ] **Step 1: Extend the `UI` interface** in `src/ui/index.ts`. Change the import line and the interface:

```ts
import type { UiState, UpgradePanelVM } from './uiState';
```

```ts
export interface UI {
  update(vm: UiState): void;
  setUpgradePanel(vm: UpgradePanelVM | null): void;
  onSelectHero: (id: string) => void;
  onStartWave: () => void;
  onRestart: () => void;
  onUpgrade: (path: number) => void;
}
```

- [ ] **Step 2: Build the panel DOM** in `createUI`, right after the deploy banner is created (after `deploy.style.display = 'none';`):

```ts
  // upgrade panel (shown when a placed tower is selected)
  const upg = el('div', 'ui-upg', overlay);
  upg.style.display = 'none';
  const upgName = el('div', 'ui-upg-name', upg);
  const upgPathName: HTMLElement[] = [];
  const upgPips: HTMLElement[][] = [];
  const upgBtns: HTMLButtonElement[] = [];
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
  }
```

- [ ] **Step 3: Add `setUpgradePanel` + `onUpgrade`** to the returned `ui` object. In the `const ui: UI = { ... }` literal, add `onUpgrade: () => {},` next to the other callbacks, and add this method next to `update`:

```ts
    setUpgradePanel(vm: UpgradePanelVM | null): void {
      if (!vm) {
        upg.style.display = 'none';
        return;
      }
      upg.style.display = 'block';
      upgName.textContent = vm.heroName;
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
      });
    },
```

- [ ] **Step 4: Add panel styles** to the end of `src/ui/ui.css`:

```css
/* ---- upgrade panel (selected tower) ---- */
.ui-upg {
  position: absolute; left: 12px; top: 12px; width: 210px; pointer-events: auto;
  padding: 10px; color: #f6e6bd; box-sizing: border-box;
  background: linear-gradient(#7d5d34, #5c4324); border: 3px solid #3a2914; border-radius: 10px;
  box-shadow: 0 6px 14px rgba(0,0,0,.45);
}
.ui-upg-name { font-weight: 800; font-size: 15px; margin-bottom: 8px; text-shadow: 0 1px 0 #2c1f0f; }
.ui-upg-path { margin-top: 8px; }
.ui-upg-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
.ui-upg-pname { font-size: 12px; font-weight: 700; }
.ui-pip { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-left: 3px; background: rgba(0,0,0,.35); border: 1px solid #3a2914; }
.ui-pip.on { background: #f0d999; }
.ui-upg-btn {
  width: 100%; padding: 6px 8px; cursor: pointer; color: #2c1f0f; font-weight: 800; font-size: 11px;
  background: linear-gradient(#caa24a, #a9802f); border: 2px solid #3a2914; border-radius: 6px;
  box-shadow: 0 2px 0 #5c4012, inset 0 1px 0 #f0d999;
}
.ui-upg-btn:disabled { filter: grayscale(.6) brightness(.72); cursor: default; box-shadow: none; }
.ui-upg-btn.locked { filter: grayscale(.8) brightness(.6); }
```

- [ ] **Step 5: Verify build**

Run: `npx tsc --noEmit && npm run build`
Expected: no type errors; build clean. (`GameScene` doesn't call the new API yet — that's Task 6.)

- [ ] **Step 6: Commit**

```bash
git add src/ui/index.ts src/ui/ui.css
git commit -m "feat: DOM upgrade panel with per-path pips and buttons"
```

---

## Task 6: GameScene selection + range ring

**Files:** Modify `src/scenes/GameScene.ts`

- [ ] **Step 1: Edit imports** in `src/scenes/GameScene.ts` — add `buildUpgradePanel` and the `Tower` type:

```ts
import { buildUiState, buildUpgradePanel } from '../ui/uiState';
```

(`Tower` is already imported as a type at the top of the file.)

- [ ] **Step 2: Add fields** next to `private ghost!: Phaser.GameObjects.Graphics;`:

```ts
  private selRing!: Phaser.GameObjects.Graphics;
  private selectedTower: Tower | null = null;
```

- [ ] **Step 3: Create the selection graphics + reset selection** in `create()`. Right after `this.ghost = this.add.graphics().setDepth(8000);` add the graphics, and where `create()` clears `this.towerViews.clear();` near the top, also reset the selection (so a `scene.restart` doesn't keep a tower from the old world):

```ts
    this.selRing = this.add.graphics().setDepth(7000);
```

Add next to the existing `this.towerViews.clear();` line:

```ts
    this.selectedTower = null;
```

- [ ] **Step 4: Replace the pointerdown handler** in `create()` (select a tower when not arming) with:

```ts
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.rightButtonDown()) {
        this.selectedHeroId = null;
        this.selectedTower = null;
        return;
      }
      if (this.selectedHeroId) {
        this.tryPlaceTower(p.x, p.y);
        return;
      }
      this.selectedTower = this.world.towerAt(p.x, p.y); // null when clicking empty ground
    });
```

- [ ] **Step 5: Clear the selection when arming a hero.** Replace the hero-key handler and `ui.onSelectHero`, and the Esc handler:

```ts
    HERO_ORDER.forEach((id, i) => {
      this.input.keyboard?.on(`keydown-${HERO_KEYS[i]}`, () => {
        this.selectedHeroId = id;
        this.selectedTower = null;
      });
    });
```

```ts
    this.input.keyboard?.on('keydown-ESC', () => {
      this.selectedHeroId = null;
      this.selectedTower = null;
    });
```

```ts
    ui.onSelectHero = (id) => {
      this.selectedHeroId = this.selectedHeroId === id ? null : id;
      this.selectedTower = null;
    };
    ui.onUpgrade = (path) => {
      if (this.selectedTower) this.world.upgradeTower(this.selectedTower, path);
    };
```

- [ ] **Step 6: Draw the selection + feed the panel.** Add a `drawSelection` method (next to `drawGhost`):

```ts
  private drawSelection(): void {
    const g = this.selRing;
    g.clear();
    const t = this.selectedTower;
    if (!t) return;
    const cs = LEVEL_ONE.cellSize;
    g.lineStyle(2, 0xf0d999, 0.95);
    g.strokeRect(t.pos.x - cs, t.pos.y - cs, cs * 2, cs * 2);
    g.lineStyle(1, 0xf0d999, 0.45);
    g.strokeCircle(t.pos.x, t.pos.y, t.stats.range);
  }
```

- [ ] **Step 7: Call them in `update()`.** After `this.drawGhost();` add:

```ts
    this.drawSelection();
    getUI().setUpgradePanel(
      this.selectedTower ? buildUpgradePanel(this.selectedTower.type.id, this.selectedTower.levels, this.world.gold) : null,
    );
```

- [ ] **Step 8: Type-check, test, build**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: no type errors; all tests pass; build clean.

- [ ] **Step 9: Manual playtest**

`npm run dev`, Chrome foreground: place a Lapu-Lapu, click him (when no hero is armed) → the upgrade panel + range ring appear; buy a Conqueror or Whirlwind level → gold drops, pip fills, range ring/attacks reflect the new stats; once one path hits L3 the other path's button greys out (locked); clicking empty ground or pressing Esc hides the panel; arming a hero (tile/keys) also hides it.

- [ ] **Step 10: Commit**

```bash
git add src/scenes/GameScene.ts
git commit -m "feat: select a placed tower to open its upgrade panel"
```

---

## Definition of Done

- `npm test` passes (existing + ~14 new assertions); `npm run build` clean.
- A placed Lapu-Lapu can be clicked to open an upgrade panel; both paths upgrade with gold, obey the one-path-past-2 rule, and change his combat stats live; selection shows a range ring; deselect via empty-click/Esc/arming.

## Follow-up (not in this plan)

Author upgrade paths for the other four heroes; optional sell button; per-tier sprite/visual changes.
