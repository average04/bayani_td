# Bayani TD — UI Overlay (Style A: Wood & Parchment)

- **Date:** 2026-06-09
- **Status:** Design approved — ready for implementation planning
- **Scope:** Replace the plain Phaser-text HUD with a styled **HTML/CSS overlay** UI in the "Carved Wood & Parchment" direction: top HUD bar, clickable build menu, start-wave button, hero tooltip, and a win/lose panel. Uses **full-image buttons with overlaid text**; art is ChatGPT-generated, the logic is hand-written.
- **Builds on:** the existing `GameScene` (which currently draws a monospace text HUD and overlay), `World`, and the hero/enemy config.

---

## 1. Goal

Give Bayani TD a polished, on-theme interface: textured wood/parchment panels, hero build tiles that are **full art images** with crisp **overlaid** text (name/cost/key), affordability and selection states, hover tooltips, and a proper victory/defeat panel — all driven by live game state, with **no emojis** (real icon art only).

## 2. Decisions (from brainstorm)

| Question | Decision |
|---|---|
| Visual style | **A — Carved Wood & Parchment** |
| Tech | **HTML/CSS DOM overlay** over the Phaser canvas (not Phaser text). Plain TypeScript, no framework. |
| Scope | **All 5**: top HUD bar, build menu, start-wave button, hero tooltip, win/lose panel |
| Buttons | **Full-image** backgrounds with **overlaid HTML text** (so values update live while art stays static) |
| Art | **ChatGPT-generated** images; **CSS-styled placeholders ship first**, real PNGs drop in with no code change |
| Icons | Real generated icon art — **no emojis** |
| Out of scope | Title screen (later ChatGPT title-art slice); changes to game logic |

## 3. Architecture

A DOM UI layer wraps the Phaser canvas inside `#game`:

```
#game (column)
 ├─ #ui-top        — HUD bar (lives / gold / wave) ............ above canvas
 ├─ #stage         — Phaser canvas mounts here (768×480)
 │    └─ #ui-overlay  — absolute, over the canvas: start button, tooltip, win/lose modal
 └─ #ui-bottom     — build menu (5 hero tiles) ................ below canvas
```

- The **canvas stays fully visible** (chrome sits above/below it), so all build spots remain clickable. `#ui-overlay` is `pointer-events: none` with interactive children `pointer-events: auto`, so tower-placement clicks pass through to the game.
- Phaser config `parent` becomes `'stage'`.
- **Boundary:** `GameScene` pushes a plain **view-model** to the UI each frame and provides intent callbacks; the UI never touches `World` directly. Pure game logic is unchanged.

### Data flow
- A pure builder `buildUiState(world, selectedHeroId, heroOrder, heroTypes)` → view-model: `{ lives, gold, wave, totalWaves, status, canStartWave, selectedHeroId, heroes: [{ id, name, cost, affordable, selected }] }`. **Unit-tested.**
- `GameScene.update()` calls `ui.update(viewModel)` each frame.
- UI intents → `GameScene`: `onSelectHero(id)`, `onStartWave()`, `onRestart()`. Keys **1–5 / SPACE / R** keep working in parallel.

## 4. Components (`src/ui/`)

- `index.ts` — builds the DOM tree, owns intent callbacks, exposes `update(viewModel)`.
- `uiState.ts` — the pure `buildUiState` builder (+ `canAfford` helper). Tested.
- `topbar.ts` — wood-bar bg image + overlaid lives/gold/wave values + stat icons.
- `buildMenu.ts` — 5 hero tiles; each tile = full image (frame + portrait) with overlaid name/cost/`[n]`; selected = gold outline; unaffordable = dimmed + non-interactive; click → `onSelectHero`.
- `startButton.ts` — button-art image + overlaid label; disabled while `!canStartWave`; click → `onStartWave`.
- `tooltip.ts` — on hover of a build tile, a panel image + overlaid range/damage/effect/cost (read from `HERO_TYPES`).
- `endPanel.ts` — when `status !== 'playing'`, a scroll/parchment modal image + overlaid result text + a Restart button → `onRestart`.

`GameScene` removes its `hudText` + `overlayText` (Phaser text) and the keydown-driven HUD strings; the in-world **enemy HP bars stay in Phaser** (they belong to the game, not the chrome).

## 5. Visual style (Style A)

Carved wood (`#5c4324`→`#7d5d34`, dark border `#3a2914`, highlight `#bd9358`) for bars/buttons; parchment (`#e7d4a4`, text `#4a3719`) for the build bar and tooltip; gold (`#d4af37`) for selection/accents. These ship as **CSS** (the design already looks like the approved mockup); ChatGPT images layer on top as `background-image` to upgrade texture and add portraits.

## 6. Asset pipeline (ChatGPT art, Claude codes)

ChatGPT generates ~14 **full-image** PNGs into `public/assets/ui/`:
- `hud-bar.png`, `build-bar.png` (panel backgrounds)
- `tile-{lapulapu,gabriela,bernardo,diwata,mangkukulam}.png` (5 hero tiles: frame + portrait, "better art")
- `icon-{lives,gold,wave}.png` (stat icons)
- `btn-start.png` (start-wave button)
- `tooltip.png` (tooltip panel), `scroll-victory.png`, `scroll-defeat.png`

Dynamic values, selection/disabled states, and key hints are **HTML/CSS overlays** — the art is static, the text is live. **Placeholder-first:** the UI is fully functional and decent-looking on CSS alone; dropping real PNGs in (referenced by the CSS classes) upgrades the look with zero code change. The generation mechanism (browser ChatGPT via Browser MCP, or the OpenAI CLI with an API key) is chosen at production time.

## 7. Testing

- **Unit:** `buildUiState` / `canAfford` (affordability, selected flag, canStartWave, formatting) — pure, no DOM.
- **Existing 51 tests** stay green (no game-logic change).
- **Visual:** verified by running the app (Chrome window foreground, per the verification gotchas).

## 8. Out of Scope / Risks
- **Out of scope:** title/main-menu screen; settings menu (the "Menu" button is decorative/no-op for now); audio; game-logic changes.
- **Risks:** (a) **pointer-events** — must let tower-placement clicks pass through the overlay; covered by the `none`/`auto` split. (b) **AI art fit** — generated tiles may need cropping/consistent sizing; the CSS placeholder guarantees a working UI regardless, and real art is swap-in. (c) **canvas scaling** — the chrome assumes the 768-wide canvas; the wrapper matches that width.
