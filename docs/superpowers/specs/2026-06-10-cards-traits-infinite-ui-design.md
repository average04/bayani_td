# Bayani TD — Hero Cards, Unique Traits, Infinite Completion, Desktop UI

Date: 2026-06-10

## Goals

1. Heroes become **cards**: the player brings exactly **4** into a run.
2. Every hero gets a **unique passive trait** (signature mechanic).
3. **Infinite mode feels complete**: boss waves, wave-clear bonus, proper defeat flow.
4. **Desktop UI fills the screen** (no dead black space) and the new screens look styled.
5. Balance pass over the result.

## 1. Hero cards (pick 4)

- New screen `src/ui/heroSelect.ts`, shown after clicking **Infinite** on the home screen:
  a grid of hero cards (portrait, name, cost, key stats, trait text). Clicking toggles
  selection; exactly 4 enables **Start**. Last loadout persists via `localSave`
  (`SaveData.loadout: string[]`, validated against `HERO_TYPES`, default = first 4 of
  `HERO_ORDER`).
- `src/game/config/loadout.ts`: module-level `setLoadout(ids)` / `getLoadout()` so the UI
  build bar and `GameScene` agree without threading params through Phaser scene config.
- `createUI` builds tiles from the loadout (4 cards + store). Hotkeys `1–4` = cards,
  `5` = store. `createUI` is called after hero select (before the Phaser game is created).
- A 6th hero makes the pick meaningful: **Apolaki** (sun god) — long-range, slow-firing,
  armor-piercing sniper. Art = `variant()` of Gabriela's LPC sheet with a gold tint;
  portrait = hue-shifted copy of her portrait via a pngjs script (consistent with the
  existing generated-art pipeline).

## 2. Unique traits (passive, always on, shown in UI)

`HeroType.trait: { id, name, desc }` + supporting fields in `TowerStats`. World logic:

| Hero | Trait | Mechanic |
|---|---|---|
| Lapu-Lapu | Rampage | Every 4th spin deals 2x damage |
| Gabriela | Deadeye | Every 5th shot crits for 3x |
| Bernardo | Aftershock | Every 3rd throw repeats the splash at 50% damage 0.45 s later |
| Diwata | Fey Mark | Enemies slowed by her take +15% damage from all sources while slowed |
| Mangkukulam | Contagion | When a poisoned enemy dies, its poison (≥1.5 s left) jumps to up to 2 enemies within 70 px |
| Apolaki | Sunpierce | Shots ignore armor; +50% damage vs enemies at ≥90% HP |

Implementation notes:

- `Tower.shotCount` drives the rhythm traits (Rampage/Deadeye/Aftershock).
- `World` gains a small `pendingHits` queue (timer, pos, radius, damage) for Aftershock.
- `Enemy` gains `damageAmp`/`ampTimer` (Fey Mark) and `takeDamage(amount, { pierce })`.
- Contagion runs in the death-resolution loop in `World.update`.
- `ShotEvent` gains an optional `crit?: boolean` so FX can sell big hits.

## 3. Infinite mode completion

- **Boss**: `bakunawa` enemy (moon-eater serpent). Big HP, heavy armor, slow, leaks 10
  lives, large bounty. Art: tinted/scaled variant of an existing monster sheet; wider HP
  bar via a `boss` flag. Every 10th wave (10, 20, 30, …) the generated/authored wave adds
  a boss spawn (authored wave 10 gets it explicitly; `generateWave` adds it for n % 10).
- **Wave-clear bonus**: on wave clear, award `10 + 2 × wave` gold (HUD popup + gold event),
  so deep-wave economy survives the per-kill nerfs.
- **Defeat screen**: shows waves survived + best; buttons **Restart** and **Home**
  (full reload back to title).
- HUD shows a boss banner while a boss wave is active.

## 4. Desktop UI

- Fit-to-viewport: scale the whole `#game` column with a CSS `transform: scale(k)`
  (k = min of width/height ratios, capped), recomputed on resize; call
  `game.scale.refresh()` after so Phaser pointer mapping tracks the transformed canvas.
- Page backdrop: replace flat near-black with the home screen's radial palette + vignette.
- Style hero-select cards consistently with the wood/parchment theme. No emojis — art only.

## 5. Balance

- Offset trait DPS: Gabriela base damage 11 → 10 (Deadeye averages +40%), Lapu-Lapu
  damage 30 → 28 (Rampage +25%). Others are situational; tune from playtests.
- Browser playtest loop: place loadout, watch waves 1–12+ incl. boss, adjust enemy
  HP ramp / bounty / bonus as observed.

## Testing

Vitest covers: rhythm traits, aftershock queue, fey mark amp, contagion spread, pierce,
boss wave generation, wave-clear bonus, loadout save/load + validation, loadout config
module. Browser verification per the known gotchas (foreground window, bigger header
limit if 431).
