# Bayani TD — Combat Mechanics & Roster Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 3 heroes (splash / slow / poison) and 3 enemies (armor / fast-swarm / regen) with a small status-effect engine, new waves, and tint-reused visuals, in a counter-triangle.

**Architecture:** Optional config fields drive new behavior; `Enemy` gains armor + timed slow/poison + regen (pure, unit-tested); `World` combat gains splash + on-hit effects; the manifest reuses existing LPC sheets via a tinted `variant()`. Existing units are unaffected (defaults preserve current behavior). `GameScene` extends hero-select to keys 1–5.

**Tech Stack:** TypeScript (strict), Phaser 3, Vite, Vitest.

**Reference spec:** `docs/superpowers/specs/2026-06-09-bayani-td-mechanics-roster-design.md` (note: spec says "6 heroes / keys 1–6"; the real count is **5 heroes / keys 1–5**).

---

## File Structure

- `src/game/config/enemies.ts` — `EnemyType` += `armor?`, `regenPerSec?`; new `ENEMY_TYPES`
- `src/game/config/heroes.ts` — `HeroType` += `splashRadius?`, `slow?`, `poison?`; new `HERO_TYPES`
- `src/game/config/waves.ts` — new waves
- `src/game/entities/enemy.ts` — armor + slow + poison + regen
- `src/game/world.ts` — splash + on-hit effects in the fire step
- `src/assets/manifest.ts` — `tint?` + `variant()` + 6 reused-sheet characters
- `src/render/enemyView.ts`, `src/render/towerView.ts` — apply tint
- `src/scenes/GameScene.ts` — hero-select keys 1–5 + HUD
- Tests: `tests/game/entities/enemyStatus.test.ts`, `tests/game/world-combat.test.ts`, `tests/game/config.test.ts`, and an update to `tests/assets/manifest.test.ts`

---

## Task 1: Config field additions

Pure optional-field additions; no behavior change. Existing data omits them → defaults apply later.

**Files:** Modify `src/game/config/enemies.ts`, `src/game/config/heroes.ts`

- [ ] **Step 1: Add fields to `EnemyType`** in `src/game/config/enemies.ts` — change the interface to:

```ts
export interface EnemyType {
  id: string;
  name: string;
  maxHp: number;
  speed: number; // pixels per second
  reward: number; // gold granted when killed
  leakDamage: number; // lives lost if it reaches the base
  armor?: number; // flat per-hit damage reduction (default 0)
  regenPerSec?: number; // hp healed per second (default 0)
}
```

- [ ] **Step 2: Add fields to `HeroType`** in `src/game/config/heroes.ts` — change the interface to:

```ts
export interface HeroType {
  id: string;
  name: string;
  cost: number;
  range: number; // pixels
  damage: number; // per shot
  fireRate: number; // shots per second
  splashRadius?: number; // if set, damage all enemies within this radius of the target
  slow?: { factor: number; duration: number }; // on-hit speed multiplier for a duration
  poison?: { dps: number; duration: number }; // on-hit damage-over-time (ignores armor)
}
```

- [ ] **Step 3: Verify + commit**

Run: `npx tsc --noEmit && npm test` — expect clean; all 38 tests pass.

```bash
git add src/game/config/enemies.ts src/game/config/heroes.ts
git commit -m "feat: add optional mechanic fields to EnemyType and HeroType"
```

---

## Task 2: Enemy status system (armor, slow, poison, regen)

**Files:** Rewrite `src/game/entities/enemy.ts`; Test `tests/game/entities/enemyStatus.test.ts`

- [ ] **Step 1: Write the failing test** `tests/game/entities/enemyStatus.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { Enemy } from '../../../src/game/entities/enemy';
import type { EnemyType } from '../../../src/game/config/enemies';
import type { Vec2 } from '../../../src/game/geometry';

const path: Vec2[] = [
  { x: 0, y: 0 },
  { x: 1000, y: 0 },
];
function etype(over: Partial<EnemyType> = {}): EnemyType {
  return { id: 'e', name: 'E', maxHp: 100, speed: 100, reward: 1, leakDamage: 1, ...over };
}

describe('Enemy status effects', () => {
  it('armor reduces incoming damage but never below 1', () => {
    const e = new Enemy(etype({ armor: 8 }), path);
    e.takeDamage(20);
    expect(e.hp).toBe(88); // 100 - (20-8)
    e.takeDamage(3); // 3-8 -> min 1
    expect(e.hp).toBe(87);
  });

  it('slow halves effective speed while active', () => {
    const e = new Enemy(etype({ speed: 100 }), path);
    e.applySlow(0.5, 10);
    e.update(1); // 100 * 0.5 * 1 = 50px
    expect(e.pos.x).toBeCloseTo(50);
  });

  it('speed returns to normal after the slow expires', () => {
    const e = new Enemy(etype({ speed: 100 }), path);
    e.applySlow(0.5, 0.5);
    e.update(0.5); // consumes the slow exactly; 100*0.5*0.5 = 25
    expect(e.pos.x).toBeCloseTo(25);
    e.update(1); // slow expired -> full speed 100
    expect(e.pos.x).toBeCloseTo(125);
  });

  it('poison deals damage over time and can kill', () => {
    const e = new Enemy(etype({ maxHp: 20 }), path);
    e.applyPoison(8, 3);
    e.update(1);
    expect(e.hp).toBeCloseTo(12);
    e.update(1);
    e.update(1); // total -24 on 20hp
    expect(e.isDead).toBe(true);
  });

  it('regen heals over time, capped at maxHp', () => {
    const e = new Enemy(etype({ maxHp: 100, regenPerSec: 6 }), path);
    e.takeDamage(50);
    e.update(1); // +6
    expect(e.hp).toBeCloseTo(56);
    for (let i = 0; i < 100; i++) e.update(1);
    expect(e.hp).toBe(100);
  });

  it('poison out-damages regen for a net loss', () => {
    const e = new Enemy(etype({ maxHp: 100, regenPerSec: 6 }), path);
    e.applyPoison(8, 10);
    e.update(1); // -8 +6 = net -2
    expect(e.hp).toBeCloseTo(98);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/entities/enemyStatus.test.ts`
Expected: FAIL — `applySlow`/`applyPoison` undefined; armor not applied.

- [ ] **Step 3: Rewrite `src/game/entities/enemy.ts`**

```ts
import type { EnemyType } from '../config/enemies';
import type { Vec2 } from '../geometry';

export class Enemy {
  readonly type: EnemyType;
  hp: number;
  pos: Vec2;
  pathIndex: number;
  reachedEnd: boolean;
  slowFactor = 1;
  slowTimer = 0;
  poisonDps = 0;
  poisonTimer = 0;
  private readonly path: Vec2[];

  constructor(type: EnemyType, path: Vec2[]) {
    this.type = type;
    this.hp = type.maxHp;
    this.path = path;
    this.pos = { x: path[0].x, y: path[0].y };
    this.pathIndex = 1;
    this.reachedEnd = path.length < 2;
  }

  update(dt: number): void {
    // poison: true damage, ignores armor
    if (this.poisonTimer > 0) {
      this.hp -= this.poisonDps * dt;
      this.poisonTimer -= dt;
      if (this.poisonTimer <= 0) this.poisonDps = 0;
    }
    // regen
    const regen = this.type.regenPerSec ?? 0;
    if (regen > 0 && this.hp > 0 && !this.reachedEnd) {
      this.hp = Math.min(this.type.maxHp, this.hp + regen * dt);
    }

    if (this.reachedEnd) return;

    // movement at the effective (possibly slowed) speed
    const speed = this.type.speed * (this.slowTimer > 0 ? this.slowFactor : 1);
    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
      if (this.slowTimer <= 0) this.slowFactor = 1;
    }
    let travel = speed * dt;
    while (travel > 0 && this.pathIndex < this.path.length) {
      const target = this.path[this.pathIndex];
      const dx = target.x - this.pos.x;
      const dy = target.y - this.pos.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= travel) {
        this.pos = { x: target.x, y: target.y };
        this.pathIndex++;
        travel -= dist;
      } else {
        this.pos = { x: this.pos.x + (dx / dist) * travel, y: this.pos.y + (dy / dist) * travel };
        travel = 0;
      }
    }
    if (this.pathIndex >= this.path.length) {
      this.reachedEnd = true;
    }
  }

  takeDamage(amount: number): void {
    this.hp -= Math.max(1, amount - (this.type.armor ?? 0));
  }

  applySlow(factor: number, duration: number): void {
    this.slowFactor = Math.min(this.slowFactor, factor);
    this.slowTimer = Math.max(this.slowTimer, duration);
  }

  applyPoison(dps: number, duration: number): void {
    this.poisonDps = Math.max(this.poisonDps, dps);
    this.poisonTimer = Math.max(this.poisonTimer, duration);
  }

  get isDead(): boolean {
    return this.hp <= 0;
  }

  get nextWaypoint(): Vec2 | null {
    return this.pathIndex < this.path.length ? this.path[this.pathIndex] : null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/game/entities/enemyStatus.test.ts tests/game/entities/enemy.test.ts`
Expected: PASS — new status tests AND the original 4 enemy tests (back-compatible: armor/regen default to 0, no slow/poison).

- [ ] **Step 5: Full suite + commit**

Run: `npm test` — expect 44 tests pass (38 + 6).

```bash
git add src/game/entities/enemy.ts tests/game/entities/enemyStatus.test.ts
git commit -m "feat: add armor, slow, poison, and regen to Enemy"
```

---

## Task 3: World combat — splash + on-hit effects

**Files:** Modify `src/game/world.ts`; Test `tests/game/world-combat.test.ts`

- [ ] **Step 1: Write the failing test** `tests/game/world-combat.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { World } from '../../src/game/world';
import type { WorldConfig } from '../../src/game/world';
import { Enemy } from '../../src/game/entities/enemy';
import type { LevelConfig } from '../../src/game/config/levels';
import type { EnemyType } from '../../src/game/config/enemies';
import type { HeroType } from '../../src/game/config/heroes';

const level: LevelConfig = {
  id: 'test',
  name: 'T',
  tileSize: 48,
  cols: 24,
  rows: 4,
  path: [
    { x: 0, y: 0 },
    { x: 1000, y: 0 },
  ],
  buildSpots: [{ x: 100, y: 40 }],
  startingGold: 1000,
  startingLives: 50,
};
const plain: EnemyType = { id: 'plain', name: 'P', maxHp: 100, speed: 0, reward: 1, leakDamage: 1 };
const armored: EnemyType = { id: 'armored', name: 'A', maxHp: 100, speed: 0, reward: 1, leakDamage: 1, armor: 8 };

function world(hero: HeroType, enemyTypes: Record<string, EnemyType>): World {
  const cfg: WorldConfig = { level, enemyTypes, heroTypes: { [hero.id]: hero }, waves: [] };
  const w = new World(cfg);
  w.placeTower(hero.id, { x: 100, y: 40 });
  return w;
}

describe('World combat effects', () => {
  it('splash damages every enemy within the splash radius of the target', () => {
    const hero: HeroType = { id: 'splash', name: 'S', cost: 0, range: 300, damage: 10, fireRate: 0.0001, splashRadius: 60 };
    const w = world(hero, { plain });
    const e1 = new Enemy(plain, level.path);
    e1.pos = { x: 200, y: 0 };
    const e2 = new Enemy(plain, level.path);
    e2.pos = { x: 230, y: 0 };
    w.enemies.push(e1, e2);
    w.update(0.016);
    expect(e1.hp).toBe(90);
    expect(e2.hp).toBe(90);
  });

  it('a slow hero slows its target', () => {
    const hero: HeroType = { id: 'slower', name: 'Sl', cost: 0, range: 300, damage: 1, fireRate: 0.0001, slow: { factor: 0.5, duration: 2 } };
    const w = world(hero, { plain });
    const e = new Enemy(plain, level.path);
    e.pos = { x: 200, y: 0 };
    w.enemies.push(e);
    w.update(0.016);
    expect(e.slowFactor).toBe(0.5);
    expect(e.slowTimer).toBeGreaterThan(0);
  });

  it('a poison hero poisons its target', () => {
    const hero: HeroType = { id: 'poisoner', name: 'Po', cost: 0, range: 300, damage: 1, fireRate: 0.0001, poison: { dps: 8, duration: 3 } };
    const w = world(hero, { plain });
    const e = new Enemy(plain, level.path);
    e.pos = { x: 200, y: 0 };
    w.enemies.push(e);
    w.update(0.016);
    expect(e.poisonDps).toBe(8);
    expect(e.poisonTimer).toBeGreaterThan(0);
  });

  it('armor reduces direct damage', () => {
    const hero: HeroType = { id: 'direct', name: 'D', cost: 0, range: 300, damage: 10, fireRate: 0.0001 };
    const w = world(hero, { armored });
    const e = new Enemy(armored, level.path);
    e.pos = { x: 200, y: 0 };
    w.enemies.push(e);
    w.update(0.016);
    expect(e.hp).toBe(98); // 100 - max(1, 10-8)
  });

  it('poison ignores armor', () => {
    const hero: HeroType = { id: 'poisoner', name: 'Po', cost: 0, range: 300, damage: 10, fireRate: 0.0001, poison: { dps: 50, duration: 2 } };
    const w = world(hero, { armored });
    const e = new Enemy(armored, level.path);
    e.pos = { x: 200, y: 0 };
    w.enemies.push(e);
    w.update(1); // direct hit this tick: 10-8 = 2 -> hp 98; poison applied
    expect(e.hp).toBe(98);
    w.update(1); // poison ticks next: 50 true damage -> hp 48
    expect(e.hp).toBe(48);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/world-combat.test.ts`
Expected: FAIL — splash not applied; slow/poison not applied.

- [ ] **Step 3: Change the geometry import in `src/game/world.ts`**

Find `import type { Vec2 } from './geometry';` and change it to:

```ts
import { distance, type Vec2 } from './geometry';
```

- [ ] **Step 4: Replace the fire step (step 3) in `World.update`** with:

```ts
    // 3. towers fire
    for (const t of this.towers) {
      t.update(dt);
      if (t.canFire) {
        const target = selectTarget(t, this.enemies);
        if (target) {
          const hero = t.type;
          const affected = hero.splashRadius
            ? this.enemies.filter(
                (e) => !e.isDead && !e.reachedEnd && distance(e.pos, target.pos) <= hero.splashRadius!,
              )
            : [target];
          for (const e of affected) {
            e.takeDamage(hero.damage);
            if (hero.slow) e.applySlow(hero.slow.factor, hero.slow.duration);
            if (hero.poison) e.applyPoison(hero.poison.dps, hero.poison.duration);
          }
          t.resetCooldown();
          this.events.shots.push({
            from: { x: t.pos.x, y: t.pos.y },
            to: { x: target.pos.x, y: target.pos.y },
            heroId: hero.id,
          });
        }
      }
    }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/game/world-combat.test.ts tests/game/world.test.ts tests/game/world-events.test.ts`
Expected: PASS — new combat tests AND the original World + World-events tests (back-compatible: no splash/slow/poison → `[target]`, `takeDamage(damage)` as before).

- [ ] **Step 6: Full suite + commit**

Run: `npm test` — expect 49 tests pass (44 + 5).

```bash
git add src/game/world.ts tests/game/world-combat.test.ts
git commit -m "feat: add splash and on-hit slow/poison to World combat"
```

---

## Task 4: New config data (heroes, enemies, waves)

**Files:** Modify `src/game/config/enemies.ts`, `src/game/config/heroes.ts`, `src/game/config/waves.ts`; Test `tests/game/config.test.ts`

- [ ] **Step 1: Add enemies to `ENEMY_TYPES`** in `src/game/config/enemies.ts` (add these three entries inside the existing record):

```ts
  kapre: { id: 'kapre', name: 'Kapre', maxHp: 120, speed: 45, reward: 18, leakDamage: 1, armor: 8 },
  tiyanak: { id: 'tiyanak', name: 'Tiyanak', maxHp: 18, speed: 130, reward: 4, leakDamage: 1 },
  manananggal: { id: 'manananggal', name: 'Manananggal', maxHp: 70, speed: 70, reward: 16, leakDamage: 1, regenPerSec: 6 },
```

- [ ] **Step 2: Add heroes to `HERO_TYPES`** in `src/game/config/heroes.ts` (add these three entries inside the existing record):

```ts
  bernardo: { id: 'bernardo', name: 'Bernardo Carpio', cost: 120, range: 100, damage: 12, fireRate: 1.2, splashRadius: 50 },
  diwata: { id: 'diwata', name: 'Diwata', cost: 90, range: 130, damage: 4, fireRate: 1.5, slow: { factor: 0.5, duration: 1.5 } },
  mangkukulam: { id: 'mangkukulam', name: 'Mangkukulam', cost: 110, range: 120, damage: 5, fireRate: 1, poison: { dps: 8, duration: 3 } },
```

- [ ] **Step 3: Extend `WAVES`** in `src/game/config/waves.ts` — append these three waves to the existing `WAVES` array (after the current wave 3):

```ts
  // wave 4 — armored intro
  {
    spawns: [
      { enemyTypeId: 'kapre', count: 2, interval: 2 },
      { enemyTypeId: 'aswang', count: 6, interval: 0.7 },
    ],
  },
  // wave 5 — swarm
  {
    spawns: [
      { enemyTypeId: 'tiyanak', count: 14, interval: 0.35 },
      { enemyTypeId: 'tiktik', count: 6, interval: 0.5 },
    ],
  },
  // wave 6 — regen + mixed
  {
    spawns: [
      { enemyTypeId: 'manananggal', count: 3, interval: 1.5 },
      { enemyTypeId: 'kapre', count: 2, interval: 2 },
      { enemyTypeId: 'tiyanak', count: 10, interval: 0.4 },
    ],
  },
```

- [ ] **Step 4: Write the config test** `tests/game/config.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ENEMY_TYPES } from '../../src/game/config/enemies';
import { HERO_TYPES } from '../../src/game/config/heroes';
import { WAVES } from '../../src/game/config/waves';

describe('config data', () => {
  it('includes the new heroes and enemies', () => {
    for (const id of ['bernardo', 'diwata', 'mangkukulam']) expect(HERO_TYPES[id]).toBeDefined();
    for (const id of ['kapre', 'tiyanak', 'manananggal']) expect(ENEMY_TYPES[id]).toBeDefined();
  });

  it('every wave spawn references a defined enemy type with a positive count', () => {
    for (const wave of WAVES) {
      for (const spawn of wave.spawns) {
        expect(ENEMY_TYPES[spawn.enemyTypeId], spawn.enemyTypeId).toBeDefined();
        expect(spawn.count).toBeGreaterThan(0);
      }
    }
  });
});
```

- [ ] **Step 5: Run + commit**

Run: `npx tsc --noEmit && npm test` — expect 51 tests pass (49 + 2). (The new enemies will render as missing-texture boxes until Task 5 adds their sprites — that's expected and harmless.)

```bash
git add src/game/config/enemies.ts src/game/config/heroes.ts src/game/config/waves.ts tests/game/config.test.ts
git commit -m "feat: add 3 heroes, 3 enemies, and 3 waves"
```

---

## Task 5: Tinted sprite variants for the new units

Reuse existing LPC sheets via a tinted `variant()` so the new units render without new art.

**Files:** Modify `src/assets/manifest.ts`, `src/render/enemyView.ts`, `src/render/towerView.ts`; update `tests/assets/manifest.test.ts`

- [ ] **Step 1: Add `tint?` to `CharacterAsset`** in `src/assets/manifest.ts`:

```ts
export interface CharacterAsset {
  key: string;
  displayScale: number;
  originY: number;
  tint?: number; // optional Phaser tint applied to the sprite
  anims: { idle: AnimClip; walk: AnimClip; attack: AnimClip; death: AnimClip };
}
```

- [ ] **Step 2: Extract the four existing characters into consts + add a `variant()` helper.** In `src/assets/manifest.ts`, move the four objects currently inline in `MANIFEST.characters` (lapulapu, gabriela, aswang, tiktik) out to module-level consts named `lapulapuChar`, `gabrielaChar`, `aswangChar`, `tiktikChar` — their contents unchanged. Add this helper just above `MANIFEST`:

```ts
// A new character that reuses an existing sheet, recolored by tint and optionally rescaled.
function variant(base: CharacterAsset, key: string, tint: number, displayScale = base.displayScale): CharacterAsset {
  return { ...base, key, tint, displayScale };
}
```

- [ ] **Step 3: Build the `characters` array from the consts + 6 variants.** Set `MANIFEST.characters` to:

```ts
  characters: [
    lapulapuChar,
    gabrielaChar,
    aswangChar,
    tiktikChar,
    variant(lapulapuChar, 'bernardo', 0xd2a679),
    variant(gabrielaChar, 'diwata', 0x7fd4ff),
    variant(lapulapuChar, 'mangkukulam', 0x9b59b6),
    variant(aswangChar, 'kapre', 0x6b4f2a, 0.9),
    variant(aswangChar, 'tiyanak', 0xff6b6b, 0.4),
    variant(tiktikChar, 'manananggal', 0xc0392b, 0.7),
  ],
```

- [ ] **Step 4: Apply the tint in `src/render/enemyView.ts`** — in the constructor, change the character-found block to also set the tint:

```ts
    if (c) {
      this.sprite.setOrigin(0.5, c.originY).setScale(c.displayScale);
      if (c.tint !== undefined) this.sprite.setTint(c.tint);
    }
```

- [ ] **Step 5: Apply the tint in `src/render/towerView.ts`** — same change in its constructor:

```ts
    if (c) {
      this.sprite.setOrigin(0.5, c.originY).setScale(c.displayScale);
      if (c.tint !== undefined) this.sprite.setTint(c.tint);
    }
```

- [ ] **Step 6: Update `tests/assets/manifest.test.ts`** — the first test hardcodes exactly four keys; change it to require the base four are present and keys are unique:

```ts
  it('has the base characters with unique keys', () => {
    const keys = MANIFEST.characters.map((c) => c.key);
    for (const base of ['lapulapu', 'gabriela', 'aswang', 'tiktik']) expect(keys).toContain(base);
    expect(new Set(keys).size).toBe(keys.length);
  });
```

- [ ] **Step 7: Verify + commit**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: no type errors; all 51 tests pass (manifest validation now covers all 10 characters — variants reference existing sheets within bounds); build clean.

```bash
git add src/assets/manifest.ts src/render/enemyView.ts src/render/towerView.ts tests/assets/manifest.test.ts
git commit -m "feat: tinted sprite variants for the new heroes and enemies"
```

---

## Task 6: Hero-select keys 1–5 + HUD

**Files:** Modify `src/scenes/GameScene.ts`

- [ ] **Step 1: Add a hero order + register keys 1–5.** In `GameScene`, add a module-level constant above the class:

```ts
const HERO_ORDER = ['lapulapu', 'gabriela', 'bernardo', 'diwata', 'mangkukulam'];
const HERO_KEYS = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE'];
```

Then in `create()`, replace the two `keydown-ONE` / `keydown-TWO` handlers with:

```ts
    HERO_ORDER.forEach((id, i) => {
      this.input.keyboard?.on(`keydown-${HERO_KEYS[i]}`, () => (this.selectedHeroId = id));
    });
```

- [ ] **Step 2: Update the HUD** — replace the body of `updateHud()` with:

```ts
  private updateHud(): void {
    const w = this.world;
    const hero = HERO_TYPES[this.selectedHeroId];
    const roster = HERO_ORDER.map((id, i) => `[${i + 1}] ${HERO_TYPES[id].name}`).join('   ');
    this.hudText.setText(
      [
        `Gold: ${w.gold}   Lives: ${w.lives}   Wave: ${w.waveNumber}/${w.totalWaves}   Best: ${this.bestWave}`,
        `Selected: ${hero.name} ($${hero.cost})   [SPACE] start wave`,
        roster,
      ].join('\n'),
    );
  }
```

- [ ] **Step 3: Type-check, test, build**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: no type errors; all 51 tests pass; build clean.

- [ ] **Step 4: Manual playtest**

Run `npm run dev`; with the **Chrome window foreground** (the loop freezes when occluded), confirm: keys 1–5 select each hero (HUD updates), the new tinted heroes place and fire with their effects, and the later waves bring Kapre (tanky), Tiyanak (swarm), and Manananggal (regen). Sanity-check the counter-triangle (poison vs armor/regen, splash vs swarm).

- [ ] **Step 5: Commit**

```bash
git add src/scenes/GameScene.ts
git commit -m "feat: hero-select keys 1-5 and roster HUD"
```

---

## Definition of Done

- `npm test` passes (51 tests); `npm run build` clean.
- 5 heroes (splash/slow/poison among them) + 5 enemies (armor/swarm/regen among them), 6 waves, tinted sprites, keys 1–5.
- Existing behavior unchanged where no new fields are set.

## Follow-up (not in this plan)

Balance tuning after playtest (numbers live in config); unique art per new unit; a graphical build menu; ChatGPT title/portraits (Slice B).
