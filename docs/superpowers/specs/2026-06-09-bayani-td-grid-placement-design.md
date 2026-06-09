# Bayani TD — Grid-Based Tower Placement

- **Date:** 2026-06-09
- **Status:** Design approved — ready for implementation planning
- **Scope:** Replace the 7 fixed build spots with **free, grid-based placement**: a hero occupies a **2×2 cell footprint** and can be placed anywhere it fits (off the path, not overlapping another hero), with a green/red hover preview.
- **Builds on:** the existing `LevelConfig` (`buildSpots`, `path`), `World.placeTower`, `GameScene` input, and `mapRenderer`.

## 1. Goal

Let the player put towers **anywhere** on a grid instead of on 7 predefined spots, with each hero taking a 2×2 block of cells.

## 2. Decisions

| Item | Decision |
|---|---|
| Grid cell | **24px** (half the 48px tile) → map 768×480 = **32 cols × 20 rows** |
| Hero footprint | **2×2 cells = 48×48px**, snapped to the grid |
| Placement | Any 2×2 area where all 4 cells are in-bounds, **not a path cell**, and **not occupied** by another hero |
| Feedback | A 2×2 **ghost preview** follows the cursor — **green** if valid, **red** if blocked; click to place |
| Build spots | **Removed** — free placement replaces them |
| Tower position | The footprint's **center pixel** (so range/targeting are unchanged) |

## 3. Model & engine (pure logic — tested)

New module **`src/game/grid.ts`** (no Phaser; unit-tested):
- `cellSize`, grid dims from the level (`gridCols = cols*tileSize/cellSize`, `gridRows` likewise).
- `pixelToCell(x, y)` / `cellCenter(col, row)` conversions.
- `footprintCells(col, row)` → the four cells `(col,row),(col+1,row),(col,row+1),(col+1,row+1)`.
- `pathCells(level)` → a `Set<"col,row">` of cells the path occupies: a cell is a path cell if its center is within `PATH_BLOCK_RADIUS` (~17px, tunable) of any path segment. Enemies still follow the same waypoint line; this only marks where you can't build.
- `canPlace(level, occupied, col, row)` → true iff every footprint cell is in-bounds, not in `pathCells`, and not in `occupied`.

**`LevelConfig`** (`src/game/config/levels.ts`): remove `buildSpots`; add `cellSize: number` (24). `LEVEL_ONE` drops its `buildSpots`.

**`World`** (`src/game/world.ts`):
- Holds an `occupied: Set<"col,row">` of cells taken by placed towers, and the precomputed `pathCells`.
- `canPlaceAt(col, row): boolean` = `grid.canPlace(level, occupied, col, row)` (and hero affordability checked in `placeTower`).
- `placeTower(heroId, col, row): boolean` — replaces the old `(heroId, pos)` form: if `canPlaceAt` and affordable, spend gold, create a `Tower` at `cellCenter`-of-footprint, and mark the 4 cells occupied.
- Targeting/combat unchanged (`Tower.pos` is the footprint center).

The existing World placement tests (place / reject-off-spot / occupied / broke) are **rewritten** against the grid model (valid placement, on-path rejected, overlap rejected, out-of-bounds rejected, unaffordable rejected).

## 4. Presentation

**`GameScene`**: on pointer move, snap the cursor to a grid cell and show the **2×2 ghost** (green if `world.canPlaceAt` + affordable, else red); on click, `world.placeTower(selectedHeroId, col, row)`. Remove `nearestBuildSpot`. The placed tower renders via the existing `TowerView` at the footprint center.

**`mapRenderer`**: draw a subtle grid overlay and the path; **remove the 7 build markers**. (Prettier ground/path *art* is a separate polish slice — out of scope here.)

## 5. Testing

- **`grid.ts`** (unit): cell↔pixel conversions, `footprintCells`, `pathCells` (path centerline blocked, off-path open), `canPlace` (in-bounds/path/occupied combinations).
- **`World`** (unit): grid placement valid/invalid cases + affordability + occupancy.
- Existing logic suites stay green where unaffected (the placement-specific tests are updated).

## 6. Out of Scope / Risks

- **Out of scope:** prettier map *art* (tiles); multiple levels; tower selling/upgrading; balance retuning.
- **Risks:** (a) **balance** — free placement is far more permissive than 7 spots, so current waves get easier; flagged for a later retune (wave difficulty or a tower cap), not part of this slice. (b) **path-cell radius** — `PATH_BLOCK_RADIUS` needs tuning so you can build right beside the path (to hit enemies) but not on it. (c) several call sites reference `buildSpots` (GameScene, mapRenderer, level/World tests) and must be updated together.
