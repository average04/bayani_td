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

## 3. Source & handoff

The user exports via **Download spritesheet** — the **standard 64×64 universal sheet** (no expanded/extra animation sets toggled on) — saves the PNG, and gives the path. The user also keeps the generator's **credits** (CSV/TXT) for attribution (LPC assets are CC-BY-SA 3.0 / GPL). Claude then does the wiring.

## 4. Wiring (the actual code change — `src/assets/manifest.ts` + the PNG)

1. Place the PNG at `public/assets/sprites/lapulapu/sheet.png` (replacing the current bare-body sheet).
2. **Measure** the PNG's width×height. Confirm it is **13 columns wide (832px)** — the standard ULPC grid — and set `MANIFEST.sheets[lapulapu].frameCount = (width/64) * (height/64)`.
3. The standard ULPC row order (spellcast, thrust, **walk**, **slash**, shoot, **hurt**) places **walk-down at 130–138**, **slash-down at 182–187**, **hurt at 260–265** — matching the current manifest. **Verify by eye**; if the generator's layout differs, remap the `rows` offsets in `lapulapuChar`.
4. Set Lapu-Lapu's **idle** clip to a swing-ready **slash frame** (e.g. `down: { start: 182, end: 182 }`, final frame chosen by what reads best) so the **bolo stays in hand at rest** — LPC only draws the weapon during the swing. Leave walk/attack/death clips unchanged.
5. Keep `displayScale 0.6` / `originY 0.85`; tune only if the dressed silhouette sits wrong.
6. Add a short **attribution comment** beside the lapulapu sheet def listing the generator + layer credits.

## 5. Verification

- `npm run build` clean (no logic/tests affected — this is an asset + manifest swap).
- Visual check: Lapu-Lapu **walks in all four facings**, **swings the bolo** on attack, and **shows the bolo while idle**; silhouette/scale looks right on the map.

## 6. Out of scope / risks

- **Out of scope:** the other heroes/enemies (later in the polish pass); Lapu-Lapu's UI build-tile portrait (separate, already-good art); the spin mechanic (already done).
- **Risks:** (a) generator export layout differs from the classic 273-frame sheet → mitigated by measuring + remapping in step 3; (b) weapon not drawn on walk/idle frames → mitigated by the slash-frame idle pose (step 4); (c) dressed silhouette may need an `originY`/`displayScale` tweak (step 5).
