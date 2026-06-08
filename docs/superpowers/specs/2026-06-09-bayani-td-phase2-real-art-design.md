# Bayani TD — Real Art Slice A: Animated Character Sprites

- **Date:** 2026-06-09
- **Status:** Design approved — ready for implementation planning
- **Scope:** **Slice A** of "real art" — generalize the asset pipeline to ingest real sprite sheets, and source/integrate CC0 (or CC-BY) animated sprites for the 4 existing characters. **Slice B** (ChatGPT title screen + hero portraits) is a separate later spec.
- **Builds on:** the Phase 2 art pipeline (`2026-06-09-bayani-td-phase2-art-design.md`) — manifest-driven Preload + animations + entity views, currently fed by procedural placeholder PNGs.

---

## 1. Goal

Replace the procedural placeholder sprites (colored squares) with **real, hand-made animated pixel art** for Lapu-Lapu, Gabriela, aswang, and tiktik — idle / walk / attack / death — sourced from license-safe packs, while keeping the game runnable at every step via placeholder fallback.

## 2. Decisions (from brainstorm)

| Question | Decision |
|---|---|
| Art approach | **Packs + ChatGPT combo** — CC0/CC-BY packs for animated characters (this slice); ChatGPT for title/portraits (Slice B) |
| Sequencing | **Spike one character end-to-end first**, then roll out the other three |
| Unsourced characters | Fall back to (existing) procedural placeholder sheets — game never breaks |

## 3. Generalize the Asset Pipeline (the core code work)

The current manifest forces every character into a rigid single 32×32 / 13-frame sheet. Real packs vary (16/32/48/64 px; per-animation files; different frame counts). Generalize the manifest so each character declares its **own** real layout. New schema:

```ts
interface SpriteSheetDef {
  key: string;
  path: string;        // under assets/
  frameWidth: number;
  frameHeight: number;
  frameCount: number;  // total frames in the sheet (for bounds validation)
}

interface AnimClip {
  sheet: string;       // references a SpriteSheetDef.key
  start: number;
  end: number;
  frameRate: number;
  repeat: number;      // -1 loop, 0 once
}

interface CharacterAsset {
  key: string;             // also the enemy/hero type id (aswang, lapulapu, …)
  displayScale: number;    // e.g. 0.75 to draw 48px art at ~36px on the 48px board
  originY: number;         // vertical anchor (feet alignment), default 0.5
  anims: { idle: AnimClip; walk: AnimClip; attack: AnimClip; death: AnimClip };
}

interface AssetManifest {
  sheets: SpriteSheetDef[];           // every spritesheet to load (characters + fx)
  characters: CharacterAsset[];
  fx: { projectile: ImageAsset; hitPuff: SheetAsset };
  map: { ground: ImageAsset; pathTile: ImageAsset; buildMarker: ImageAsset };
}
```

Why this shape: a character's four clips can each point to a *different* sheet (real packs often ship `idle.png`, `walk.png`, …) **or** all point to one sheet (the placeholder layout). A Phaser sprite can play animations whose frames come from different textures, so per-animation sheets work without re-packing.

**Code touched:**
- `PreloadScene` — load every `manifest.sheets` entry as a spritesheet (plus fx/map as today).
- `animations.ts` — for each character + state, create anim `"<key>-<state>"` from `generateFrameNumbers(clip.sheet, { start, end })` at `frameRate`/`repeat`.
- `enemyView.ts` / `towerView.ts` — create the sprite from the character's walk/idle clip sheet, `setScale(displayScale)`, `setOrigin(0.5, originY)`, then play the state anim.
- Placeholder characters are expressed in the new schema (all four clips reference one 32×32 sheet, `displayScale: 1`, `originY: 0.5`) so the **fallback still works unchanged in behavior**.

## 4. Sourcing (honest about the risk)

- I will **web-search and download** CC0 / CC-BY animated character packs from **direct-URL sources** (OpenGameArt, GitHub-hosted CC0 sets) that allow `curl` — itch.io generally does not, so it's a manual hand-off if we want a specific itch pack.
- Each sourced sheet goes under `public/assets/sprites/<character>/…`, described in `manifest.sheets`, with license + author + URL recorded in a root `CREDITS.md`.
- **Style:** aim for a cohesive low-res fantasy set — warriors for the heroes, creatures for aswang/tiktik — themed via palette toward Filipino characters. Perfect on-theme matches are not guaranteed.
- **Any character not cleanly sourced keeps its placeholder** (the generator stays). "Real art for character X" = swap its manifest entry + drop its files; no other code changes.

## 5. Spike-First Sequencing

1. **Spike:** source + download + wire in **one** character end-to-end (prove the generalized pipeline + the download path + scaling/origin on the board).
2. Decide: roll out to the remaining three, or pivot a stubborn character to upgraded-procedural.
3. Update `CREDITS.md` as each lands.

## 6. File Structure (new / changed)

```
src/assets/manifest.ts          # generalized schema + MANIFEST (placeholders re-expressed)
src/scenes/PreloadScene.ts      # load manifest.sheets
src/render/animations.ts        # anims from character clips
src/render/enemyView.ts         # displayScale + originY; base texture from clip
src/render/towerView.ts         # displayScale + originY; base texture from clip
scripts/gen-placeholders.mjs    # unchanged — still generates fallback sheets
public/assets/sprites/<char>/   # real downloaded sheets (per sourced character)
CREDITS.md                      # NEW: per-asset license + attribution
tests/assets/manifest.test.ts   # generalized validation
```

## 7. Testing

- **Manifest validation (unit):** every character defines idle/walk/attack/death; each `clip.sheet` exists in `sheets`; `0 <= start <= end < sheet.frameCount`; `frameRate > 0`; `displayScale > 0`; every sheet path starts with `assets/`.
- **Existing suite:** the 35 game-logic tests are unaffected (no logic change).
- **Presentation:** verified by running the game. Per `browser-verification-gotchas`, the **Chrome window must be foreground** to watch motion (the rAF loop freezes when occluded); logic correctness is proven by Vitest, not screenshots.

## 8. Out of Scope / Risks

- **Out of scope:** ChatGPT title screen + portraits (Slice B); roster expansion; Tiled maps; audio; per-direction (up/down) art (still horizontal flip).
- **Risks:** (a) **sourcing** — I may not find good license-safe matches via direct URLs; mitigated by the spike + placeholder fallback. (b) **license compliance** — every asset must be CC0/CC-BY with attribution in `CREDITS.md`; reject anything unclear. (c) **style cohesion** — mixed-source art may clash; mitigated by palette theming and preferring one multi-character pack. (d) **scale/anchor** — varying frame sizes need per-character `displayScale`/`originY` tuning so feet sit on the path.
