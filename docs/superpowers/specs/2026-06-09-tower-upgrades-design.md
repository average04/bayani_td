# Bayani TD — Tower Upgrades (2 paths × 4 levels)

- **Date:** 2026-06-09
- **Status:** Design approved — ready for implementation planning
- **Scope:** Placed towers can be **upgraded** along **2 paths, 4 levels each**, Bloons-style restricted. Build the system generically; author paths for **Lapu-Lapu only** for now.

## 1. The rule (Bloons-restricted)

Each tower tracks a level **0–4 on each of two paths**. The next level on a path may be bought when:

- the path is not yet at 4, **and**
- the player can afford its cost, **and**
- for level **3 or 4**, the *other* path is still **≤ 2**.

Result: you may take **one** path all the way to 4, while the other tops out at 2. (With only two paths, "only one path past tier 2" reduces to the third condition above.)

## 2. Model

- **`Tower`** gains `levels: [number, number]` (per-path, 0–4) and an **effective `stats`** object — the combat numbers (`damage`, `range`, `fireRate`, `splashRadius?`, `slow?`, `poison?`, `spin?`). It keeps `type` for identity/display (id, name, cost). `stats` is recomputed whenever a level is bought: start from the base hero stats, then apply each purchased upgrade's `delta` (numeric fields add; `slow`/`poison` are set).
- **Combat reads `tower.stats`** instead of the shared read-only `tower.type` (`resetCooldown` → `stats.fireRate`, `inRange` → `stats.range`, the world fire step → `stats.damage`/`splashRadius`/`slow`/`poison`/`spin`).
- **Upgrades are data-driven** in `src/game/config/upgrades.ts`:
  ```
  StatDelta   = { damage?, range?, fireRate?, splashRadius? (additive); slow?, poison? (set) }
  UpgradeLevel= { name, cost, desc, delta }
  UpgradePath = { name, levels: UpgradeLevel[4] }
  UPGRADES    : Record<heroId, [UpgradePath, UpgradePath]>
  ```
  Heroes with no entry are simply not upgradable.

## 3. Lapu-Lapu's two paths (starting numbers, tunable)

Base: damage 25 · range 80 · attack speed 0.8 · melee spin.

| | **Path A — Conqueror** (power) | **Path B — Whirlwind** (speed + slow) |
|---|---|---|
| L1 | Sharpened Bolo — +12 dmg · 60g | Quick Strikes — +0.3 atk speed · 50g |
| L2 | Warrior's Might — +20 dmg, +10 range · 120g | Cyclone — +0.4 atk speed · 110g |
| L3 | Datu's Fury — +35 dmg · 220g | Dizzying Spin — Slow 0.65× / 1s · 190g |
| L4 | Hero of Mactan — +70 dmg, +15 range · 420g | Tempest — +0.5 atk speed, Slow 0.5× / 1.5s · 360g |

## 4. World API (pure, tested)

- `towerAt(x, y): Tower | null` — the tower whose 2×2 footprint contains the point.
- `canUpgrade(tower, path): boolean` — the rule in §1 (max + cross-path lock; affordability checked in `upgradeTower`).
- `nextUpgradeCost(tower, path): number | null` — cost of the next level, or null if maxed.
- `upgradeTower(tower, path): boolean` — if `canUpgrade` and affordable: spend, `levels[path]++`, recompute `stats`.

## 5. Selecting & upgrading (presentation)

- When **not** in deploy-arming mode, **clicking a placed tower selects it**; clicking empty ground or pressing **Esc** deselects. Arming a hero clears the selection (and vice-versa).
- The selected tower shows a **highlight + range ring** on the map (a Phaser graphics overlay, like the placement ghost).
- A **wood-panel DOM overlay** (matching the build menu) shows: hero name, a **pip row per path** (filled pips = current level), and an **Upgrade button per path** with the next level's name + cost. A button is disabled (greyed) when the path is maxed, locked by the rule, or unaffordable. Clicking it calls `world.upgradeTower`.
- Driven by a pure view-model (extend `uiState` or a sibling) computed from the selected tower + world.

## 6. Out of scope / assumptions

- **Out of scope:** selling towers; per-level sprite changes; authoring upgrades for the other four heroes (added as each is polished); refunds.
- **Assumption:** level shown as pips only (no on-sprite tier art).

## 7. Testing

- `upgrades` config + stat computation: effective stats after a sequence of upgrades.
- `canUpgrade`: max, affordability-independent lock cases (A→3 locks B at 2; both-at-2 either can advance; etc.).
- `upgradeTower`: success spends gold and bumps the level; failure (locked / maxed / broke) leaves state unchanged.
- `towerAt`: hit inside a footprint vs. outside.
