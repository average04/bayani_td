# Bayani TD — Real Art Slice A: 3/4 Animated Character Sprites

- **Date:** 2026-06-09
- **Status:** Design approved — ready for implementation planning
- **Scope:** **Slice A** of "real art" — move the game to a **3/4 top-down perspective**, generalize the asset pipeline to ingest real *directional* sprite sheets, and source/integrate **LPC** (CC-BY-SA) animated sprites for the 4 existing characters. **Slice B** (ChatGPT title screen + hero portraits) is a separate later spec.
- **Builds on:** the Phase 2 art pipeline (`2026-06-09-bayani-td-phase2-art-design.md`) — manifest-driven Preload + animations + entity views, currently fed by flat procedural placeholder PNGs.

---

## 1. Goal

Give Bayani TD a **3/4 top-down look** (Stardew/JRPG-style angle, rectangular grid) with real, hand-made animated pixel art for Lapu-Lapu, Gabriela, aswang, and tiktik — directional idle / walk / attack / death — while keeping the game runnable at every step via placeholder fallback.

## 2. Decisions (from brainstorm)

| Question | Decision |
|---|---|
| Art approach | **Packs + ChatGPT combo** — packs for animated characters (this slice); ChatGPT for title/portraits (Slice B) |
| Perspective | **3/4 top-down** (rectangular grid kept; depth-sort + directional art) — not true diamond isometric |
| Primary art source | **LPC** (Liberated Pixel Cup), **CC-BY-SA 3.0 / GPL** — attribution + share-alike, tracked in `CREDITS.md` |
| Sequencing | **Spike one character end-to-end first**, then roll out the other three |
| Unsourced characters | Fall back to procedural placeholder sheets — game never breaks |

**The pure game logic (`src/game/`) and its 35 tests are untouched.** Logic stays in the existing 2D plane; only the *renderer* applies the 3/4 look (directional facing, depth-sort, scale). The rectangular grid, path, and build spots are unchanged.

## 3. Generalize the Asset Pipeline — now directional

The manifest grows from a rigid single 32×32 / 13-frame sheet to per-character, per-direction clips. New schema:

```ts
type Facing = 'down' | 'up' | 'side';   // 'side' is drawn once and flipped for left

interface SpriteSheetDef {
  key: string;
  path: string;          // under assets/
  frameWidth: number;
  frameHeight: number;
  frameCount: number;    // total frames (for bounds validation)
}

interface DirClip { start: number; end: number; }   // frame range within a sheet

interface AnimClip {
  sheet: string;         // references a SpriteSheetDef.key
  frameRate: number;
  repeat: number;        // -1 loop, 0 once
  rows: Partial<Record<Facing, DirClip>>;  // at least 'down'; missing facings fall back to 'down'
}

interface CharacterAsset {
  key: string;           // also the enemy/hero type id
  displayScale: number;  // e.g. 0.6 to draw 64px LPC art at ~38px on the 48px board
  originY: number;       // feet anchor, ~0.9
  anims: { idle: AnimClip; walk: AnimClip; attack: AnimClip; death: AnimClip };
}

interface AssetManifest {
  sheets: SpriteSheetDef[];
  characters: CharacterAsset[];
  fx: { projectile: ImageAsset; hitPuff: SheetAsset };
  map: { ground: ImageAsset; pathTile: ImageAsset; buildMarker: ImageAsset };
}
```

A character's clips may reference one shared sheet (placeholder) or several (real per-animation files). A Phaser sprite can play animations whose frames come from different textures, so this needs no re-packing.

**Code touched:**
- `PreloadScene` — load every `manifest.sheets` entry as a spritesheet (plus fx/map as today).
- `animations.ts` — for each character, state, and **each facing present** in `clip.rows`, create anim `"<key>-<state>-<facing>"` from `generateFrameNumbers(clip.sheet, clip.rows[facing])`.
- `enemyView.ts` / `towerView.ts` — see §4 (facing + depth-sort + scale/origin).
- Placeholder characters are re-expressed in the schema with a single `down` row per state, `displayScale: 1`, `originY: 0.5` — fallback behavior unchanged.

## 4. The 3/4 renderer (view layer)

- **Facing from motion/aim.** Enemy: from its movement delta `(dx, dy)` — if `|dy| > |dx|` then `down`/`up`, else `side` with `flipX = dx < 0`. Tower: from aim to its target while attacking; `down` when idle. The view plays `"<key>-<state>-<facing>"`, falling back to the `down` anim if a facing is missing.
- **Depth-sort.** Each character sprite sets `depth = sprite.y` every frame so entities lower on screen overlap those behind. Map layers sit at large negative depths; FX just above their source; HP-bars and HUD/overlay on a fixed high depth so UI is always on top.
- **Feet anchor + scale.** `setOrigin(0.5, character.originY)` and `setScale(character.displayScale)` so sprites stand on the tile and sort by their feet.

## 5. Sourcing (LPC primary)

- Download **LPC** character sheets from **direct-URL sources** (OpenGameArt LPC submissions / GitHub LPC repos that allow `curl`). The standard LPC layout is 64×64 frames in rows (walk = up/left/down/right × frames; slash = attack; hurt = death). We map: `walk` rows → up/down/side; `attack` → slash rows; `death` → hurt row (single direction); `idle` → a standing frame of walk.
- Each sheet is described in `manifest.sheets`; every asset's **author + license + URL** is recorded in a root `CREDITS.md`.
- **Style:** cohesive — warriors for the heroes, creatures for aswang/tiktik — palette-themed toward Filipino characters where feasible. Aswang/tiktik may use LPC monster/creature submissions.
- Any character not cleanly sourced **keeps its placeholder**. Adding real art for a character = its `manifest` entry + its files; no other code change.

## 6. Spike-First Sequencing

1. **Spike:** source + download + wire in **one** LPC character end-to-end — proving directional anims, depth-sort, scale/origin, and the download path.
2. Decide: roll out to the other three, or pivot a stubborn character to procedural.
3. Update `CREDITS.md` as each lands.

## 7. File Structure (new / changed)

```
src/assets/manifest.ts          # directional schema + MANIFEST (placeholders re-expressed)
src/scenes/PreloadScene.ts      # load manifest.sheets
src/render/animations.ts        # per-character/state/facing anims
src/render/facing.ts            # NEW: facing-from-delta helper (pure, unit-tested)
src/render/enemyView.ts         # facing + depth-sort + scale/origin
src/render/towerView.ts         # facing + depth-sort + scale/origin
src/scenes/GameScene.ts         # depth scheme for FX/HP-bars/HUD on top of y-sorted entities
scripts/gen-placeholders.mjs    # unchanged — still generates fallback sheets
public/assets/sprites/<char>/   # real LPC sheets (per sourced character)
CREDITS.md                      # NEW: per-asset license + attribution
tests/assets/manifest.test.ts   # generalized validation
tests/render/facing.test.ts     # NEW: facing helper
```

## 8. Testing

- **Manifest validation (unit):** every character defines idle/walk/attack/death; each `clip.sheet` exists in `sheets`; each `row` has `0 <= start <= end < sheet.frameCount`; every state has at least a `down` row; `frameRate > 0`; `displayScale > 0`; sheet paths start with `assets/`.
- **Facing helper (unit):** `facingFromDelta(dx, dy)` returns the correct `{ facing, flipX }` for cardinal and diagonal-ish deltas — the one piece of view logic that is pure and worth testing.
- **Existing suite:** the 35 game-logic tests are unaffected.
- **Presentation:** verified by running the game. Per `browser-verification-gotchas`, the **Chrome window must be foreground** to watch motion (the rAF loop freezes when occluded).

## 9. Out of Scope / Risks

- **Out of scope:** ChatGPT title screen + portraits (Slice B); roster expansion; Tiled maps; audio; true isometric.
- **Risks:** (a) **sourcing** — a complete LPC character often needs layered composition (body+clothes+weapon) via the LPC generator; we prefer pre-composed sheets and fall back to placeholders; the spike de-risks this. (b) **license** — LPC is CC-BY-SA/GPL: attribution + share-alike required, recorded in `CREDITS.md`; reject anything with unclear licensing. (c) **scale/anchor** — per-character `displayScale`/`originY` tuning so feet sit on the path. (d) **directional gaps** — death is usually single-direction in LPC; the `down`-fallback handles missing facings.
