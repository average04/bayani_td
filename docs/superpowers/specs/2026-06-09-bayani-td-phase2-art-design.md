# Bayani TD — Phase 2 (Art Slice): Animated Pixel Art Design

- **Date:** 2026-06-09
- **Status:** Design approved — ready for implementation planning
- **Scope:** The **first slice of Phase 2** — replace the placeholder shapes with real, animated pixel-art sprites for the current roster (2 heroes, 2 enemies), plus combat FX and a real map background. Roster expansion and Tiled maps are *separate* later slices.
- **Builds on:** `2026-06-09-bayani-td-tech-stack-design.md` and the completed Phases 0–1 core game.

---

## 1. Goal

Make Bayani TD *look* like the pixel-art game it's meant to be: animated Filipino-hero towers and folklore enemies (aswang, tiktik) on a textured map, with combat that reads (projectiles, hits, deaths) — replacing the current colored circles/lines.

## 2. Decisions (from brainstorm)

| Question | Decision |
|---|---|
| First Phase 2 slice | **Real pixel art** (over roster / Tiled / juice) |
| Art source | **Hybrid** — free CC0 packs for generic bits, ChatGPT-generated accents for Filipino characters |
| Animation level | **Full** — idle / walk / attack / death per character |
| Execution approach | **A — pipeline-first against a fixed asset manifest**, placeholder sheets now, real art swapped in with no code changes |

> **Reality note:** fully AI-generated multi-frame animation is inconsistent. Real animation comes from **animated CC0 character packs themed toward a Filipino look** (Aseprite tweaks), with ChatGPT used for accents (Lapu-Lapu's bolo, the tiktik's wings, a title image) — not for generating whole cycles frame-by-frame.

## 3. Asset Manifest — the contract

A single module `src/assets/manifest.ts` is the source of truth the code builds against. Real art and placeholder art are interchangeable as long as they match it (same keys, dimensions, frame counts).

**Characters** (4): `lapulapu`, `gabriela`, `aswang`, `tiktik`. Each is a sprite sheet at **32×32 px/frame**, displayed scaled to fit the board, with four animation states:

| State | When it plays |
|---|---|
| `idle` | tower standing / enemy spawn settle |
| `walk` | enemy moving along the path |
| `attack` | tower firing |
| `death` | enemy killed (plays once, then the sprite is destroyed) |

- **Facing:** single side-view art, flipped horizontally based on movement direction (enemies) or aim direction (towers). Vertical path segments keep the last horizontal facing. No 4-directional art.
- Manifest entry per character: texture key, file path, frame width/height, and per-state `{ startFrame, endFrame, frameRate, repeat }`.

**Combat FX** (visual only): `projectile` (small sprite), `hit-puff` (short impact animation). These are cosmetic — game logic stays instant-hit.

**Map:** `ground` (a repeating ground tile) and `path-tile` (a path texture). Rendered at runtime (see §4) so art is **decoupled from exact path geometry** — no baked-in background. Optional `build-marker` sprite for placeable tiles.

The manifest defines: `key`, `path`, `frameWidth`, `frameHeight`, and animation ranges. A validation test asserts it is well-formed.

## 4. Technical Pipeline (code)

Pure game logic (`src/game/`) stays untouched **except** one small additive change to `World` (events, §4.5). Everything else is presentation.

### 4.1 PreloadScene
New scene between Boot and Game. Loads every asset in the manifest (sheets, FX, map tiles) and shows a simple loading indicator. Scene order becomes `Boot → Preload → Game`.

### 4.2 Animation registry
`src/render/animations.ts` registers Phaser animations from the manifest (idle/walk/attack/death per character, plus the hit-puff). Called once after preload.

### 4.3 Entity view layer
`src/render/enemyView.ts` and `src/render/towerView.ts` map a logic entity → a Phaser sprite. Responsibilities:
- On spawn: create sprite, play `walk` (enemy) / `idle` (tower).
- Each frame: sync sprite position to `entity.pos`; flip X by direction.
- On state change: enemy plays `death` (once) then destroys; tower plays `attack` when it fires.
- The `GameScene` owns a `Map<Enemy, EnemyView>` / `Map<Tower, TowerView>`, reconciling created/removed entities each frame against `world.enemies` / `world.towers`.

### 4.4 FX
`src/render/fx.ts`: spawn a `projectile` sprite tweened from tower→target (~0.12 s, fire-and-forget), a `hit-puff` at the impact point, and a tower fire flash. Driven by World events (§4.5).

### 4.5 World events (the only logic change — additive, testable)
`World` gains a per-tick `events` accumulator, cleared at the start of each `update(dt)`:
- `shots: { from: Vec2; to: Vec2; heroId: string }[]` — pushed when a tower fires.
- `deaths: { pos: Vec2; enemyTypeId: string }[]` — pushed when an enemy dies from damage.
- (`leaks` optional, same shape, for a later leak FX.)

The scene reads `world.events` *after* `world.update()` to drive projectile/hit/death FX. Logic remains instant-hit; existing behavior and tests are unaffected. New unit tests assert events are emitted correctly.

### 4.6 Map renderer
`src/render/mapRenderer.ts`: a repeating `ground` TileSprite across 768×480, a textured path strip drawn along `LEVEL_ONE.path` using `path-tile`, and subtle build-spot markers. Replaces the current immediate-mode brown line.

### 4.7 GameScene refactor
Replace immediate-mode entity drawing with: map renderer (once in `create`), the view-layer reconciliation + FX (each frame), and `world.events` consumption. The HUD stays as-is. Build-spot placement input is unchanged.

## 5. Asset Production (parallel track)

1. Source animated CC0 character packs (warrior/monster) with idle/walk/attack/death cycles that fit the silhouette.
2. Theme them toward Filipino characters in Aseprite (palette, accents).
3. Use ChatGPT (via Browser MCP → logged-in tab) for accent ideas and a title/portrait image; clean up in Aseprite.
4. Until real files land, **placeholder sheets** (simple colored frames matching the manifest dims/counts) keep the pipeline runnable and tests green. Swapping in real art requires **no code change** — same keys, same dimensions.

## 6. File Structure (new / changed)

```
public/assets/
  sprites/lapulapu.png · gabriela.png · aswang.png · tiktik.png
  fx/projectile.png · hit-puff.png
  map/ground.png · path-tile.png · build-marker.png   (placeholders first)
src/assets/manifest.ts          # asset + animation manifest (the contract)
src/render/animations.ts        # register Phaser anims from manifest
src/render/enemyView.ts         # Enemy -> sprite sync
src/render/towerView.ts         # Tower -> sprite sync
src/render/fx.ts                # projectile / hit-puff / fire flash
src/render/mapRenderer.ts       # ground + path + build markers
src/scenes/PreloadScene.ts      # NEW: load manifest assets
src/scenes/GameScene.ts         # refactor: views + map + FX (presentation only)
src/game/world.ts               # additive: per-tick events accumulator
tests/game/world-events.test.ts # events emitted correctly
tests/assets/manifest.test.ts   # manifest well-formed
```

## 7. Testing

- **Unit (pure logic):** `world-events` — towers firing push `shots`; killed enemies push `deaths`; accumulator clears each tick; existing 29 tests still pass.
- **Manifest validation:** every character has all four states; frame ranges are within bounds; no duplicate keys; referenced paths are non-empty.
- **Presentation:** verified by running the game (and screenshots once browser capture cooperates). View/FX layers are not unit-tested (Phaser rendering).

## 8. Phasing Within the Slice

Each step is independently visible in-game:
1. Preload + manifest + **enemies** (walk + death) replacing enemy circles.
2. **Heroes** (idle + attack) + tower fire FX replacing tower circles.
3. **Map background** (ground + textured path + build markers).
4. **Projectile + hit FX** wired to World events.

## 9. Out of Scope / Risks

- **Out of scope:** Tiled-authored maps and multiple levels (later slice); roster expansion (later slice); audio, particles, screen-shake (Phase 4); 4-directional sprites (we flip horizontally); final shippable art polish (iterative).
- **Risks:** (a) art sourcing + Aseprite cleanup is the long pole — mitigated by the placeholder pipeline so code never blocks; (b) AI animation inconsistency — mitigated by CC0 animated bases; (c) path/art coupling — mitigated by runtime path rendering rather than a baked background.
