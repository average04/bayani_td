# Bayani TD — Combat Mechanics & Roster Expansion

- **Date:** 2026-06-09
- **Status:** Design approved — ready for implementation planning
- **Scope:** Add **3 new heroes + 3 new enemies**, each introducing one combat mechanic, plus the small status-effect engine they need, new waves, and tint-based visuals. One cohesive slice (all combat mechanics).
- **Builds on:** the data-driven config (`src/game/config/*`) + pure logic (`Enemy`, `Tower`, `World`) and the 3/4 LPC art pipeline.

---

## 1. Goal

Make Bayani TD feel like a real tower-defense game by adding **mechanics**, not just stats: an AoE hero, a slow hero, a poison hero, an armored enemy, a fast-swarm enemy, and a regenerating enemy — forming a counter-triangle that rewards mixing towers.

## 2. Roster & mechanics (Filipino mythology)

| New hero | Mechanic | New enemy | Mechanic |
|---|---|---|---|
| **Bernardo Carpio** (earthshaker) | **Splash** — full damage to all enemies within a radius of the target | **Kapre** (tree giant) | **Armor** — flat per-hit damage reduction; high HP; slow |
| **Diwata** (forest deity) | **Slow** — timed speed debuff on hit | **Tiyanak** (demon infants) | **Fast swarm** — many, fast, low HP (data only) |
| **Mangkukulam** (curse-caster) | **Poison** — damage-over-time; **bypasses armor** | **Manananggal** (segmenting vampire) | **Regen** — heals over time |

**Counter-triangle:** Kapre's armor → beaten by Lapu-Lapu's big hits or Mangkukulam's armor-ignoring poison. Tiyanak swarm → beaten by Bernardo's splash or Gabriela's fast fire. Manananggal's regen → beaten by Mangkukulam's poison (out-damages the heal). Diwata's slow buffs every tower.

## 3. Balance (author-decided; tune after playtest)

**Heroes** — `cost / range / damage / fireRate / effect`:
- Bernardo Carpio — 120 / 100 / 12 / 1.2 / `splashRadius: 50`
- Diwata — 90 / 130 / 4 / 1.5 / `slow: { factor: 0.5, duration: 1.5 }`
- Mangkukulam — 110 / 120 / 5 / 1.0 / `poison: { dps: 8, duration: 3 }`

**Enemies** — `maxHp / speed / reward / leakDamage / effect`:
- Kapre — 120 / 45 / 18 / 1 / `armor: 8`
- Tiyanak — 18 / 130 / 4 / 1 / *(swarm via wave design)*
- Manananggal — 70 / 70 / 16 / 1 / `regenPerSec: 6`

Existing units unchanged. `startingGold` stays 150 (tune later if needed).

## 4. Engine changes (pure logic — the tested core)

All additions are optional/back-compatible; existing units (no armor/regen/effects) behave exactly as today.

### 4.1 Config fields
```ts
// EnemyType (+)
armor?: number;        // flat per-hit reduction, default 0
regenPerSec?: number;  // hp healed per second, default 0

// HeroType (+)
splashRadius?: number;
slow?: { factor: number; duration: number };
poison?: { dps: number; duration: number };
```

### 4.2 `Enemy` status system
New mutable state + methods:
- **Armor:** `takeDamage(amount)` → `hp -= Math.max(1, amount - (type.armor ?? 0))` (always ≥ 1 so nothing is fully immune).
- **Slow:** fields `slowFactor` (default 1) + `slowTimer` (default 0). `applySlow(factor, duration)` takes the stronger factor (`min`) and longer duration (`max`). Movement uses `type.speed * (slowTimer > 0 ? slowFactor : 1)`; when the timer expires, `slowFactor` resets to 1.
- **Poison:** fields `poisonDps` (default 0) + `poisonTimer` (default 0). `applyPoison(dps, duration)` takes the stronger dps + longer duration. In `update(dt)`: while `poisonTimer > 0`, `hp -= poisonDps * dt` (**true damage — no armor**), decrement the timer; reset dps when it expires. Poison can reduce hp to ≤ 0 → the enemy dies and is resolved (rewarded) by `World` like any kill.
- **Regen:** in `update(dt)`, if `regenPerSec > 0` and the enemy is alive and hasn't leaked, `hp = min(maxHp, hp + regenPerSec * dt)` (applied alongside poison, so poison can out-damage regen).
- **`update(dt)` order:** apply poison → apply regen → move at the effective (possibly slowed) speed and decrement the slow timer.

### 4.3 `World` combat
When a tower fires at its target, replace the single `target.takeDamage(...)` with:
- Determine **affected** enemies: if `hero.splashRadius`, all alive, un-leaked enemies within `splashRadius` of the target's position (includes the target); otherwise just `[target]`.
- For each affected enemy: `takeDamage(hero.damage)`; if `hero.slow` → `applySlow(...)`; if `hero.poison` → `applyPoison(...)`.
- Then `resetCooldown()` and push the existing shot event (from tower → target).

Targeting is unchanged. `World` adds a `distance` import for the splash radius check.

## 5. Visuals (tint reuse — cheap)
New units **reuse existing LPC sheets** via a tint, so no new sourcing:
- Manifest `CharacterAsset` gains optional `tint?: number`; `EnemyView`/`TowerView` call `sprite.setTint(tint)` when present.
- Heroes reuse the male/female body sheets; enemies reuse the ghost/bat sheets, each with a distinct tint and `displayScale` (Kapre larger ~0.9; Tiyanak smaller ~0.5). New characters' clips reference the existing sheet keys with the same frame ranges as their base sheet.
- Unique art per new unit is a later follow-up.

## 6. Waves
Extend `WAVES` with new waves that introduce the new enemies (e.g. a Kapre+aswang wave, a Tiyanak swarm wave, a Manananggal mixed wave) — roughly doubling the campaign length. Exact composition decided during planning; existing early waves unchanged.

## 7. Testing
New Vitest coverage for every mechanic (pure logic):
- **Enemy:** armor reduces damage and never below 1; slow lowers effective speed for its duration then restores; poison deals DoT over time and can kill; regen heals and caps at maxHp; poison out-damages regen net-negative.
- **World:** splash damages multiple enemies in radius; a slow hero slows its target; a poison hero poisons its target; an armored enemy takes reduced direct damage but full poison damage.
- The existing 38 tests stay green (back-compatible defaults).

## 8. Out of Scope / Risks
- **In scope (presentation):** `GameScene` hero-select extends to **number keys 1–6** with a HUD line listing all six heroes (the existing keys-1/2 + HUD pattern, widened).
- **Out of scope:** unique art for the new units (tint reuse for now); new *levels*/maps; a graphical build menu (keys stay the selection method); audio.
- **Risks:** (a) **balance** is first-pass and will need a playtest pass — numbers are easy to tune in config. (b) **HUD/controls**: 6 heroes need keys 1–6 and a wider HUD line — handled in the GameScene update. (c) tint reuse means several units share silhouettes — acceptable until unique art.
