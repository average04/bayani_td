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

## 3. Source & approach (final: generator export)

An interim scripted composite (makrohn layers + a dagger) shipped first, then the user built the character in the [LPC Character Generator](https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/) and exported the full **Spritesheet (PNG)** — a red-clad warrior with topknot, red headband, and a blade. That export is the final sprite; the interim script (`scripts/build-lapulapu-sprite.mjs`) was removed to avoid overwriting it.

## 4. Wiring

The modern generator exports the **18-column / 66-row (1188-frame)** layout, not the classic 13-column / 273-frame sheet, so the manifest is remapped (verified by rendering an overview + frame strips):

- `public/assets/sprites/lapulapu/sheet.png` = the user's export (1152×4224).
- `MANIFEST.sheets[lapulapu].frameCount` = **1188**.
- Row blocks unchanged in order (walk 8–11, slash 12–15, hurt 20), direction order up/left/down/right; `index = row*18 + col`:
  - walk: down 180–188, up 144–152, side 198–206
  - attack (slash): down 252–257, up 216–221, side 270–275
  - death (hurt): down 360–365
  - idle: down 180 (the blade shows on walk frames, so the bolo is visible at rest)
- `displayScale 0.6` / `originY 0.85` unchanged.

## 5. Verification (done)

Overview + full-scale strips confirmed facings (144 up, 180 down with blade, 198 side), the slash swing (252–257), and the stagger-fall death (360–365). `npm run build` clean. Note: `bernardo` and `mangkukulam` are tint-variants that reuse this sheet, so they now appear as recolored Lapu-Lapu until their own polish pass.

## 5. Verification

- `npm run build` clean (no logic/tests affected — this is an asset + manifest swap).
- Visual check: Lapu-Lapu **walks in all four facings**, **swings the bolo** on attack, and **shows the bolo while idle**; silhouette/scale looks right on the map.

## 6. Out of scope / risks

- **Out of scope:** the other heroes/enemies (later in the polish pass); Lapu-Lapu's UI build-tile portrait (separate, already-good art); the spin mechanic (already done).
- **Risks:** (a) generator export layout differs from the classic 273-frame sheet → mitigated by measuring + remapping in step 3; (b) weapon not drawn on walk/idle frames → mitigated by the slash-frame idle pose (step 4); (c) dressed silhouette may need an `originY`/`displayScale` tweak (step 5).
