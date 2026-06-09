# Bayani TD — Grid-Based Tower Placement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 7 fixed build spots with free placement on a 24px grid (32×20), where a hero occupies a 2×2 cell footprint placeable anywhere off the path and not overlapping another hero, with a green/red hover ghost.

**Architecture:** A new pure `src/game/grid.ts` (cell math, path-cell set, `canPlace`) is the tested core. `World` precomputes path cells, tracks occupied cells, and `placeTower(heroId, col, row)` validates against the grid. `GameScene` snaps the cursor to a 2×2 footprint and shows a ghost; `mapRenderer` draws a grid and drops the build markers. Game logic stays otherwise unchanged.

**Tech Stack:** TypeScript (strict), Phaser 3, Vite, Vitest.

**Reference spec:** `docs/superpowers/specs/2026-06-09-bayani-td-grid-placement-design.md`

---

## File Structure

- `src/game/grid.ts` (new) — cell/pixel math, `pathCells`, `canPlace`, `footprintTopLeftAt`
- `src/game/config/levels.ts` (modify) — add `cellSize`; (Task 4) remove `buildSpots`
- `src/game/world.ts` (modify) — path/occupied cells, cell-based `placeTower`, `canPlaceAt`
- `src/scenes/GameScene.ts` (modify) — 2×2 ghost preview + cell-based placement
- `src/render/mapRenderer.ts` (modify) — grid overlay, remove build markers
- Tests: `tests/game/grid.test.ts` (new); update `tests/game/world.test.ts`, `world-events.test.ts`, `world-combat.test.ts`

---

## Task 1: Grid module + `cellSize`

**Files:** Modify `src/game/config/levels.ts` (+ the 3 test level configs); Create `src/game/grid.ts`, `tests/game/grid.test.ts`

- [ ] **Step 1: Add `cellSize` to `LevelConfig` and every level config.** In `src/game/config/levels.ts`, add `cellSize: number;` to the `LevelConfig` interface (after `rows`), and `cellSize: 24,` to `LEVEL_ONE` (after `rows: 10,`). Keep `buildSpots` for now.

Then add `cellSize: 24,` to the inline `level` objects in **`tests/game/world.test.ts`**, **`tests/game/world-events.test.ts`**, and **`tests/game/world-combat.test.ts`** (each has a `const level: LevelConfig = { ... }` — add the field after its `rows`). This keeps `tsc` green.

- [ ] **Step 2: Write the failing test** `tests/game/grid.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  gridCols,
  gridRows,
  pixelToCell,
  cellCenter,
  footprintCenter,
  footprintCells,
  footprintTopLeftAt,
  pathCells,
  canPlace,
  cellKey,
} from '../../src/game/grid';
import type { LevelConfig } from '../../src/game/config/levels';

const level: LevelConfig = {
  id: 't',
  name: 'T',
  tileSize: 48,
  cols: 16,
  rows: 10,
  cellSize: 24,
  path: [
    { x: 0, y: 120 },
    { x: 768, y: 120 },
  ],
  buildSpots: [],
  startingGold: 100,
  startingLives: 20,
};

describe('grid', () => {
  it('derives grid dimensions from the level', () => {
    expect(gridCols(level)).toBe(32);
    expect(gridRows(level)).toBe(20);
  });

  it('converts pixels to cells and computes centers', () => {
    expect(pixelToCell(level, 50, 28)).toEqual({ col: 2, row: 1 });
    expect(cellCenter(level, 0, 0)).toEqual({ x: 12, y: 12 });
    expect(footprintCenter(level, 0, 0)).toEqual({ x: 24, y: 24 });
  });

  it('lists the four cells of a 2x2 footprint', () => {
    expect(footprintCells(3, 4)).toEqual([
      { col: 3, row: 4 },
      { col: 4, row: 4 },
      { col: 3, row: 5 },
      { col: 4, row: 5 },
    ]);
  });

  it('centers a 2x2 footprint near a pointer, clamped to bounds', () => {
    expect(footprintTopLeftAt(level, 100, 100)).toEqual({ col: 3, row: 3 });
    expect(footprintTopLeftAt(level, -50, -50)).toEqual({ col: 0, row: 0 });
    expect(footprintTopLeftAt(level, 9999, 9999)).toEqual({ col: 30, row: 18 });
  });

  it('marks cells along the path line as blocked', () => {
    const blocked = pathCells(level);
    expect(blocked.has(cellKey(10, 5))).toBe(true); // path at y=120 -> row 5
    expect(blocked.has(cellKey(10, 0))).toBe(false); // far from the path
  });

  it('canPlace respects bounds, path, and occupancy', () => {
    const blocked = pathCells(level);
    const occupied = new Set<string>();
    expect(canPlace(level, blocked, occupied, 4, 0)).toBe(true); // off-path
    expect(canPlace(level, blocked, occupied, 4, 4)).toBe(false); // footprint hits path row 5
    expect(canPlace(level, blocked, occupied, 31, 0)).toBe(false); // col+1 out of bounds
    occupied.add(cellKey(6, 0));
    expect(canPlace(level, blocked, occupied, 6, 0)).toBe(false); // occupied
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/game/grid.test.ts`
Expected: FAIL — cannot resolve `grid`.

- [ ] **Step 4: Create `src/game/grid.ts`**

```ts
import { distance, type Vec2 } from './geometry';
import type { LevelConfig } from './config/levels';

export interface Cell {
  col: number;
  row: number;
}

// A cell whose center is within this many px of the path line is "blocked" (you can't build on it).
const PATH_BLOCK_RADIUS = 18;

export function gridCols(level: LevelConfig): number {
  return (level.cols * level.tileSize) / level.cellSize;
}

export function gridRows(level: LevelConfig): number {
  return (level.rows * level.tileSize) / level.cellSize;
}

export function pixelToCell(level: LevelConfig, x: number, y: number): Cell {
  return { col: Math.floor(x / level.cellSize), row: Math.floor(y / level.cellSize) };
}

export function cellCenter(level: LevelConfig, col: number, row: number): Vec2 {
  return { x: col * level.cellSize + level.cellSize / 2, y: row * level.cellSize + level.cellSize / 2 };
}

// Center pixel of a 2x2 footprint whose top-left cell is (col,row).
export function footprintCenter(level: LevelConfig, col: number, row: number): Vec2 {
  return { x: (col + 1) * level.cellSize, y: (row + 1) * level.cellSize };
}

export function footprintCells(col: number, row: number): Cell[] {
  return [
    { col, row },
    { col: col + 1, row },
    { col, row: row + 1 },
    { col: col + 1, row: row + 1 },
  ];
}

export function cellKey(col: number, row: number): string {
  return `${col},${row}`;
}

// The 2x2 footprint top-left cell whose center sits nearest pixel (x,y), clamped on-board.
export function footprintTopLeftAt(level: LevelConfig, x: number, y: number): Cell {
  const cs = level.cellSize;
  const col = Math.round(x / cs) - 1;
  const row = Math.round(y / cs) - 1;
  return {
    col: Math.max(0, Math.min(gridCols(level) - 2, col)),
    row: Math.max(0, Math.min(gridRows(level) - 2, row)),
  };
}

function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return distance(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return distance(p, { x: a.x + t * dx, y: a.y + t * dy });
}

// Set of "col,row" keys for cells the path runs through.
export function pathCells(level: LevelConfig): Set<string> {
  const blocked = new Set<string>();
  const cols = gridCols(level);
  const rows = gridRows(level);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const c = cellCenter(level, col, row);
      for (let i = 1; i < level.path.length; i++) {
        if (distToSegment(c, level.path[i - 1], level.path[i]) <= PATH_BLOCK_RADIUS) {
          blocked.add(cellKey(col, row));
          break;
        }
      }
    }
  }
  return blocked;
}

// Can a 2x2 footprint with top-left (col,row) be placed?
export function canPlace(
  level: LevelConfig,
  blocked: Set<string>,
  occupied: Set<string>,
  col: number,
  row: number,
): boolean {
  const cols = gridCols(level);
  const rows = gridRows(level);
  for (const cell of footprintCells(col, row)) {
    if (cell.col < 0 || cell.row < 0 || cell.col >= cols || cell.row >= rows) return false;
    const k = cellKey(cell.col, cell.row);
    if (blocked.has(k) || occupied.has(k)) return false;
  }
  return true;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/game/grid.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Full suite + commit**

Run: `npx tsc --noEmit && npm test`
Expected: clean; all tests pass (53 + 6 = 59).

```bash
git add src/game/grid.ts tests/game/grid.test.ts src/game/config/levels.ts tests/game/world.test.ts tests/game/world-events.test.ts tests/game/world-combat.test.ts
git commit -m "feat: add grid module and cellSize to levels"
```

---

## Task 2: World cell-based placement

**Files:** Modify `src/game/world.ts`; Update `tests/game/world.test.ts`, `tests/game/world-events.test.ts`, `tests/game/world-combat.test.ts`

- [ ] **Step 1: Update the placement tests in `tests/game/world.test.ts`.** Replace the two placement-specific `it(...)` blocks and the "kill" test's `placeTower` call so they use cells:

```ts
  it('places a tower on a valid cell and charges gold', () => {
    const w = new World(makeConfig());
    expect(w.placeTower('h', 2, 2)).toBe(true);
    expect(w.gold).toBe(50);
    expect(w.towers.length).toBe(1);
  });

  it('rejects placement on the path, on an occupied footprint, or when broke', () => {
    const w = new World(makeConfig());
    expect(w.placeTower('h', 0, 0)).toBe(false); // footprint over the path
    expect(w.placeTower('h', 2, 2)).toBe(true); // gold 100 -> 50
    expect(w.placeTower('h', 2, 2)).toBe(false); // occupied
    expect(w.placeTower('h', 5, 2)).toBe(true); // gold 50 -> 0
    expect(w.placeTower('h', 8, 2)).toBe(false); // broke
  });
```

In the "lets a tower kill the spawned enemy" test, change `w.placeTower('h', { x: 50, y: 48 })` to `w.placeTower('h', 2, 2)` (everything else in that test is unchanged).

- [ ] **Step 2: Update `tests/game/world-events.test.ts`.** Change `w.placeTower('h', { x: 50, y: 48 })` to `w.placeTower('h', 2, 2)`, and change the shot-from assertion `expect(w.events.shots[0].from).toEqual({ x: 50, y: 48 })` to `expect(w.events.shots[0].from).toEqual({ x: 72, y: 72 })` (the 2×2 footprint at cell (2,2) centers at pixel (72,72)).

- [ ] **Step 3: Update `tests/game/world-combat.test.ts`.** In the `world(hero, enemyTypes)` helper, change `w.placeTower(hero.id, { x: 100, y: 40 })` to `w.placeTower(hero.id, 2, 2)` (the towers keep range 300, so they still reach the test enemies at x≈200).

- [ ] **Step 4: Run tests to verify they fail**

Run: `npx vitest run tests/game/world.test.ts tests/game/world-events.test.ts tests/game/world-combat.test.ts`
Expected: FAIL — `placeTower` still takes a `Vec2`, not `(col, row)`.

- [ ] **Step 5: Modify `src/game/world.ts`.**

(a) Add to the imports:

```ts
import { pathCells, canPlace, footprintCenter, footprintCells, cellKey } from './grid';
```

(b) Add two fields to the class (next to `enemies`/`towers`):

```ts
  private readonly blockedCells: Set<string>;
  private readonly occupiedCells = new Set<string>();
```

(c) In the constructor, after `this.waveManager = new WaveManager(cfg.waves);`, add:

```ts
    this.blockedCells = pathCells(cfg.level);
```

(d) Replace the entire `placeTower` method with:

```ts
  canPlaceAt(col: number, row: number): boolean {
    return canPlace(this.level, this.blockedCells, this.occupiedCells, col, row);
  }

  placeTower(heroId: string, col: number, row: number): boolean {
    const hero = this.heroTypes[heroId];
    if (!hero) return false;
    if (!this.canPlaceAt(col, row)) return false;
    if (!this.economy.spend(hero.cost)) return false;
    this.towers.push(new Tower(hero, footprintCenter(this.level, col, row)));
    for (const cell of footprintCells(col, row)) this.occupiedCells.add(cellKey(cell.col, cell.row));
    return true;
  }
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/game/world.test.ts tests/game/world-events.test.ts tests/game/world-combat.test.ts`
Expected: PASS.

- [ ] **Step 7: Full suite + commit**

Run: `npx tsc --noEmit && npm test`
Expected: clean; all 59 tests pass. (`GameScene` still calls the old `placeTower(heroId, pos)` — it is updated in Task 3; `tsc` will FLAG that. If so, that's expected — proceed to Task 3 in the same session before declaring the build green. To keep this task green on its own, the commit below stages only `world.ts` + tests; do Task 3 immediately after.)

```bash
git add src/game/world.ts tests/game/world.test.ts tests/game/world-events.test.ts tests/game/world-combat.test.ts
git commit -m "feat: cell-based grid placement in World"
```

> Note: `GameScene.tryPlaceTower` calls `placeTower(id, spot)` (two args) — after this task `tsc --noEmit` will error there until Task 3. Run Task 3 right away; do not pause with a red type-check.

---

## Task 3: GameScene ghost preview + mapRenderer grid

**Files:** Modify `src/scenes/GameScene.ts`, `src/render/mapRenderer.ts`

- [ ] **Step 1: Rewrite `src/render/mapRenderer.ts`** — draw the ground, the path, and a subtle grid; remove the build markers:

```ts
import Phaser from 'phaser';
import type { LevelConfig } from '../game/config/levels';
import { MANIFEST } from '../assets/manifest';
import { gridCols, gridRows } from '../game/grid';

// Draws the ground, a tiled path strip along the waypoints, and a subtle placement grid.
export function renderMap(scene: Phaser.Scene, level: LevelConfig): void {
  const width = level.cols * level.tileSize;
  const height = level.rows * level.tileSize;

  scene.add.tileSprite(0, 0, width, height, MANIFEST.map.ground.key).setOrigin(0, 0).setDepth(-20);

  const step = level.tileSize / 2;
  for (let i = 1; i < level.path.length; i++) {
    const a = level.path[i - 1];
    const b = level.path[i];
    const segLen = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
    const count = Math.max(1, Math.ceil(segLen / step));
    for (let s = 0; s <= count; s++) {
      const t = s / count;
      const x = Phaser.Math.Linear(a.x, b.x, t);
      const y = Phaser.Math.Linear(a.y, b.y, t);
      scene.add.image(x, y, MANIFEST.map.pathTile.key).setDepth(-15);
    }
  }

  // subtle placement grid
  const grid = scene.add.graphics().setDepth(-12);
  grid.lineStyle(1, 0x000000, 0.08);
  const cs = level.cellSize;
  for (let c = 0; c <= gridCols(level); c++) grid.lineBetween(c * cs, 0, c * cs, height);
  for (let r = 0; r <= gridRows(level); r++) grid.lineBetween(0, r * cs, width, r * cs);
}
```

- [ ] **Step 2: Edit `src/scenes/GameScene.ts` imports.** Add the grid import, and **remove** the now-unused `Vec2` import (it was only used by `nearestBuildSpot`, deleted in Step 5 — strict `tsc` errors on the unused import otherwise):

```ts
import { footprintTopLeftAt } from '../game/grid';
```

Delete this line near the top of the file:

```ts
import type { Vec2 } from '../game/geometry';
```

- [ ] **Step 3: Add a ghost field** to the class (next to `hpBars`):

```ts
  private ghost!: Phaser.GameObjects.Graphics;
```

- [ ] **Step 4: Create the ghost in `create()`** — right after `this.hpBars = this.add.graphics().setDepth(9000);`, add:

```ts
    this.ghost = this.add.graphics().setDepth(8000);
```

- [ ] **Step 5: Replace `tryPlaceTower` and `nearestBuildSpot`** with cell-based placement + ghost drawing. Replace both methods with:

```ts
  private tryPlaceTower(x: number, y: number): void {
    if (this.world.status !== 'playing') return;
    const { col, row } = footprintTopLeftAt(LEVEL_ONE, x, y);
    this.world.placeTower(this.selectedHeroId, col, row);
  }

  private drawGhost(): void {
    const g = this.ghost;
    g.clear();
    if (this.world.status !== 'playing') return;
    const p = this.input.activePointer;
    if (p.x < 0 || p.y < 0 || p.x > this.scale.width || p.y > this.scale.height) return;
    const { col, row } = footprintTopLeftAt(LEVEL_ONE, p.x, p.y);
    const hero = HERO_TYPES[this.selectedHeroId];
    const ok = this.world.canPlaceAt(col, row) && this.world.gold >= hero.cost;
    const cs = LEVEL_ONE.cellSize;
    g.fillStyle(ok ? 0x2ecc71 : 0xe74c3c, 0.35);
    g.lineStyle(2, ok ? 0x2ecc71 : 0xe74c3c, 0.9);
    g.fillRect(col * cs, row * cs, cs * 2, cs * 2);
    g.strokeRect(col * cs, row * cs, cs * 2, cs * 2);
  }
```

- [ ] **Step 6: Call `drawGhost()` each frame.** In `update()`, add `this.drawGhost();` right after `this.drawHpBars();`:

```ts
  update(_time: number, delta: number): void {
    if (this.world.status === 'playing') {
      this.world.update(delta / 1000);
    }
    this.consumeEvents();
    this.syncViews();
    this.drawHpBars();
    this.drawGhost();
    getUI().update(buildUiState(this.world, this.selectedHeroId, this.bestWave, HERO_ORDER, HERO_TYPES));
    this.handleEndState();
  }
```

- [ ] **Step 7: Type-check, test, build**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: no type errors; all 59 tests pass; build clean.

- [ ] **Step 8: Manual playtest**

Run `npm run dev`; with the **Chrome window foreground**, confirm: a 2×2 ghost follows the cursor — green over open ground, red over the path or an existing tower; clicking on a green spot places the selected hero anywhere; you can no longer only build on 7 spots; towers still fire and waves still play.

- [ ] **Step 9: Commit**

```bash
git add src/scenes/GameScene.ts src/render/mapRenderer.ts
git commit -m "feat: 2x2 ghost-preview grid placement in GameScene"
```

---

## Task 4: Remove the dead `buildSpots`

Now that nothing references `buildSpots`, remove it.

**Files:** Modify `src/game/config/levels.ts`; Update the 3 test level configs

- [ ] **Step 1: Remove `buildSpots` from `LevelConfig`** in `src/game/config/levels.ts` (delete the `buildSpots: Vec2[];` interface line and the `buildSpots: [ ... ],` array from `LEVEL_ONE`).

- [ ] **Step 2: Remove `buildSpots` from the three test level configs** — delete the `buildSpots: [...]` line from the `const level` object in `tests/game/world.test.ts`, `tests/game/world-events.test.ts`, and `tests/game/world-combat.test.ts`.

- [ ] **Step 3: Type-check, test, build**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: no type errors (nothing references `buildSpots`); all 59 tests pass; build clean.

- [ ] **Step 4: Commit**

```bash
git add src/game/config/levels.ts tests/game/world.test.ts tests/game/world-events.test.ts tests/game/world-combat.test.ts
git commit -m "refactor: remove unused buildSpots from levels"
```

---

## Definition of Done

- `npm test` passes (59 tests); `npm run build` clean.
- Towers place freely on the grid (2×2 footprint) anywhere off the path and non-overlapping, with a green/red hover ghost; the 7 fixed build spots are gone.
- Pure grid logic is unit-tested; game/combat behavior is unchanged.

## Follow-up (not in this plan)

Balance retune for free placement (wave difficulty or a tower cap); prettier map art; the sprite-polish slice (next, per the user).
