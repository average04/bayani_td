# Bayani TD — Lapu-Lapu Dressed Sprite (bolo + clothes + headdress)

- **Date:** 2026-06-09
- **Status:** Design approved — ready for implementation planning
- **Scope:** Replace Lapu-Lapu's bare LPC base-body spritesheet with a **dressed, bolo-wielding** composited sheet exported from the LPC Character Generator. First of a hero-by-hero sprite-polish pass; **only Lapu-Lapu** here.

## 1. Goal

Give Lapu-Lapu a proper character sprite — Filipino warrior with clothes, a headdress, and a bolo — instead of the un-clothed universal base body. No game-logic changes: the sheet stays in the **universal LPC layout** so the existing animation frame indices keep working.

## 2. The look (user picks in the generator)

Built in the [Universal LPC Spritesheet Character Generator](https://sanderfrenken.github.io/Universal-LPC-Spritesheet-Character-Generator/):

- **Body:** male, **brown/amber** skin; short **black** hair.
- **Headdress:** **red headband / bandana** (iconic Lapu-Lapu); a feathered/native headgear if available.
- **Clothes:** earth-tone **vest / sleeveless top** + **loincloth** (or simple pants).
- **Weapon:** **Sword** (or Saber) — stands in for the bolo; visible during the swing.

## 3. Source & approach (revised: scripted compositing)

The browser tool could not reliably drive the LPC generator (interactions timed out), so the sheet is built by a **script** instead: `scripts/build-lapulapu-sprite.mjs` (npm `gen:lapulapu`). It downloads classic-layout layer PNGs from [makrohn/Universal-LPC-spritesheet](https://github.com/makrohn/Universal-LPC-spritesheet) and alpha-composites them (back→front) into the 832×1344 sheet. All layers share the universal grid, so no offsets are needed. Layers:

1. `body/male/tanned2` — tanned warrior body (includes head/face)
2. `legs/skirt/male/robe_skirt_male` — lower-body wrap (loincloth/kilt)
3. `torso/leather/chest_male` — leather chest / vest
4. `hair/male/bangsshort/black` — short black hair
5. `head/bandanas/male/red` — red headband
6. `weapons/right hand/male/dagger_male` — the **bolo** (a short blade; the oversize curved saber uses a non-aligned 1152×768 grid, deferred)

## 4. Wiring

- Output overwrites `public/assets/sprites/lapulapu/sheet.png` — same **832×1344 / 273-frame** layout as before, so `MANIFEST` needs **no changes** (frame indices and `displayScale 0.6` / `originY 0.85` still hold).
- The dagger layer is drawn on the **walk and slash frames**, so the bolo is visible at idle (frame 130) too — **no idle-frame tweak needed** (the earlier plan to repose idle on a slash frame is unnecessary).
- Attribution recorded in `CREDITS.md`.

## 4b. Verification (done)

Frames 130/144/156/182/185 extracted and viewed: tanned warrior with red headband, black hair, leather vest, brown wrap, and the blade in his right hand across walk/slash. `npm run build` clean.

## 5. Verification

- `npm run build` clean (no logic/tests affected — this is an asset + manifest swap).
- Visual check: Lapu-Lapu **walks in all four facings**, **swings the bolo** on attack, and **shows the bolo while idle**; silhouette/scale looks right on the map.

## 6. Out of scope / risks

- **Out of scope:** the other heroes/enemies (later in the polish pass); Lapu-Lapu's UI build-tile portrait (separate, already-good art); the spin mechanic (already done).
- **Risks:** (a) generator export layout differs from the classic 273-frame sheet → mitigated by measuring + remapping in step 3; (b) weapon not drawn on walk/idle frames → mitigated by the slash-frame idle pose (step 4); (c) dressed silhouette may need an `originY`/`displayScale` tweak (step 5).
