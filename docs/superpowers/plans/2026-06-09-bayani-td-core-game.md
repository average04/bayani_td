# Bayani TD — Core Game (Phases 0–1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully playable, single-level browser tower-defense prototype where Filipino-hero towers shoot folklore enemies (aswang, tiktik) walking a path, with gold economy, waves, and win/lose.

**Architecture:** Pure, framework-agnostic game logic lives in `src/game/` (unit-tested with Vitest, no Phaser imports). Phaser 3 scenes in `src/scenes/` render that logic each frame using immediate-mode graphics (colored shapes) and drive a `World.update(dt)` simulation tick. A thin `src/services/` holds local persistence. No real art or backend yet — those are Phase 2/3.

**Tech Stack:** TypeScript (strict), Phaser 3, Vite, Vitest. Placeholder shape graphics; localStorage for best-wave persistence.

**Reference spec:** `docs/superpowers/specs/2026-06-09-bayani-td-tech-stack-design.md`

---

## File Structure

Pure logic (no Phaser — unit tested):
- `src/game/geometry.ts` — `Vec2`, `distance`
- `src/game/config/levels.ts` — `LevelConfig`, `LEVEL_ONE`
- `src/game/config/enemies.ts` — `EnemyType`, `ENEMY_TYPES`
- `src/game/config/heroes.ts` — `HeroType`, `HERO_TYPES`
- `src/game/config/waves.ts` — `WaveSpawn`, `WaveConfig`, `WAVES`
- `src/game/entities/enemy.ts` — `Enemy`
- `src/game/entities/tower.ts` — `Tower`
- `src/game/systems/economy.ts` — `Economy`
- `src/game/systems/targeting.ts` — `selectTarget`
- `src/game/systems/waveManager.ts` — `WaveManager`
- `src/game/state/gameState.ts` — `GameStatus`, `GameState`
- `src/game/world.ts` — `World`, `WorldConfig`
- `src/services/localSave.ts` — `loadSave`, `saveBestWave`

Presentation (Phaser — run/observe to verify):
- `src/main.ts` — Phaser game config
- `src/scenes/BootScene.ts` — entry scene
- `src/scenes/GameScene.ts` — render + input + sim loop

Project config: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`, `eslint.config.js`, `.prettierrc.json`.

Tests live in `tests/` mirroring `src/game/` paths.

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`, `src/main.ts`, `src/scenes/BootScene.ts`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "bayani-td",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint .",
    "format": "prettier --write ."
  },
  "dependencies": {
    "phaser": "^3.80.1"
  },
  "devDependencies": {
    "@eslint/js": "^8.57.0",
    "eslint": "^8.57.0",
    "prettier": "^3.3.0",
    "typescript": "^5.4.5",
    "typescript-eslint": "^7.13.0",
    "vite": "^5.2.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"]
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 3: Create `vite.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Bayani TD</title>
    <style>
      html, body { margin: 0; height: 100%; background: #0d140e; }
      #game { display: flex; justify-content: center; align-items: center; height: 100%; }
    </style>
  </head>
  <body>
    <div id="game"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `.gitignore`, `eslint.config.js`, and `.prettierrc.json`**

`.gitignore`:

```gitignore
node_modules
dist
coverage
.env
.env.local
.DS_Store
```

`eslint.config.js` (flat config; underscore-prefixed names are allowed unused):

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);
```

`.prettierrc.json`:

```json
{
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100
}
```

- [ ] **Step 6: Create `src/scenes/BootScene.ts`**

```ts
import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    // No assets to preload yet (placeholder graphics are drawn immediately).
    this.scene.start('Game');
  }
}
```

- [ ] **Step 7: Create a temporary `src/main.ts` (replaced in Task 13)**

```ts
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 768,
  height: 480,
  backgroundColor: '#1d2b1f',
  pixelArt: true,
  parent: 'game',
  scene: [BootScene],
};

new Phaser.Game(config);
```

- [ ] **Step 8: Install dependencies**

Run: `npm install`
Expected: completes without errors; `node_modules/` created.

- [ ] **Step 9: Verify dev server boots and tooling runs**

Run: `npm run dev`
Expected: Vite prints a local URL (e.g. `http://localhost:5173`). Open it — you should see a dark-green canvas (the empty Phaser game). Stop the server with Ctrl+C.

Then run: `npm run lint`
Expected: completes with exit code 0 (warnings are acceptable; there should be no errors).

- [ ] **Step 10: Commit**

```bash
git add package.json tsconfig.json vite.config.ts index.html .gitignore eslint.config.js .prettierrc.json src/main.ts src/scenes/BootScene.ts package-lock.json
git commit -m "chore: scaffold Vite + Phaser + TypeScript + Vitest project"
```

---

## Task 2: Geometry helpers

**Files:**
- Create: `src/game/geometry.ts`
- Test: `tests/game/geometry.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { distance } from '../../src/game/geometry';

describe('distance', () => {
  it('computes euclidean distance between two points', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('is zero for identical points', () => {
    expect(distance({ x: 7, y: 2 }, { x: 7, y: 2 })).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/geometry.test.ts`
Expected: FAIL — cannot resolve `../../src/game/geometry`.

- [ ] **Step 3: Write minimal implementation**

```ts
export interface Vec2 {
  x: number;
  y: number;
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/game/geometry.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/game/geometry.ts tests/game/geometry.test.ts
git commit -m "feat: add Vec2 and distance geometry helper"
```

---

## Task 3: Config data (levels, enemies, heroes, waves)

These are static data modules with their type definitions. No tests (plain data), but `tsc` validates them. Each is a separate file with one responsibility.

**Files:**
- Create: `src/game/config/levels.ts`, `src/game/config/enemies.ts`, `src/game/config/heroes.ts`, `src/game/config/waves.ts`

- [ ] **Step 1: Create `src/game/config/enemies.ts`**

```ts
export interface EnemyType {
  id: string;
  name: string;
  maxHp: number;
  speed: number; // pixels per second
  reward: number; // gold granted when killed
  leakDamage: number; // lives lost if it reaches the base
}

export const ENEMY_TYPES: Record<string, EnemyType> = {
  aswang: { id: 'aswang', name: 'Aswang', maxHp: 60, speed: 60, reward: 10, leakDamage: 1 },
  tiktik: { id: 'tiktik', name: 'Tiktik', maxHp: 30, speed: 110, reward: 6, leakDamage: 1 },
};
```

- [ ] **Step 2: Create `src/game/config/heroes.ts`**

```ts
export interface HeroType {
  id: string;
  name: string;
  cost: number;
  range: number; // pixels
  damage: number; // per shot
  fireRate: number; // shots per second
}

export const HERO_TYPES: Record<string, HeroType> = {
  lapulapu: { id: 'lapulapu', name: 'Lapu-Lapu', cost: 100, range: 110, damage: 20, fireRate: 1 },
  gabriela: { id: 'gabriela', name: 'Gabriela Silang', cost: 75, range: 140, damage: 6, fireRate: 3 },
};
```

- [ ] **Step 3: Create `src/game/config/levels.ts`**

Tile centers are computed as `c * tileSize + tileSize/2`. With `tileSize = 48`, the map is 16×10 tiles (768×480 px).

```ts
import type { Vec2 } from '../geometry';

export interface LevelConfig {
  id: string;
  name: string;
  tileSize: number;
  cols: number;
  rows: number;
  path: Vec2[]; // pixel waypoints, spawn -> base
  buildSpots: Vec2[]; // pixel centers where towers may be placed
  startingGold: number;
  startingLives: number;
}

export const LEVEL_ONE: LevelConfig = {
  id: 'level-one',
  name: 'Barrio Outskirts',
  tileSize: 48,
  cols: 16,
  rows: 10,
  // (col,row) -> px center: (0,4)(7,4)(7,7)(12,7)(12,2)(15,2)
  path: [
    { x: 24, y: 216 },
    { x: 360, y: 216 },
    { x: 360, y: 360 },
    { x: 600, y: 360 },
    { x: 600, y: 120 },
    { x: 744, y: 120 },
  ],
  // tile centers not on the path
  buildSpots: [
    { x: 168, y: 168 },
    { x: 264, y: 264 },
    { x: 456, y: 312 },
    { x: 456, y: 408 },
    { x: 552, y: 216 },
    { x: 648, y: 216 },
    { x: 696, y: 168 },
  ],
  startingGold: 150,
  startingLives: 20,
};
```

- [ ] **Step 4: Create `src/game/config/waves.ts`**

```ts
export interface WaveSpawn {
  enemyTypeId: string;
  count: number;
  interval: number; // seconds between each spawn in this group
}

export interface WaveConfig {
  spawns: WaveSpawn[];
}

export const WAVES: WaveConfig[] = [
  { spawns: [{ enemyTypeId: 'aswang', count: 8, interval: 0.9 }] },
  {
    spawns: [
      { enemyTypeId: 'aswang', count: 6, interval: 0.8 },
      { enemyTypeId: 'tiktik', count: 6, interval: 0.6 },
    ],
  },
  {
    spawns: [
      { enemyTypeId: 'tiktik', count: 10, interval: 0.5 },
      { enemyTypeId: 'aswang', count: 8, interval: 0.7 },
    ],
  },
];
```

- [ ] **Step 5: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/game/config
git commit -m "feat: add level, enemy, hero, and wave config data"
```

---

## Task 4: Enemy entity

**Files:**
- Create: `src/game/entities/enemy.ts`
- Test: `tests/game/entities/enemy.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { Enemy } from '../../../src/game/entities/enemy';
import type { EnemyType } from '../../../src/game/config/enemies';
import type { Vec2 } from '../../../src/game/geometry';

const type: EnemyType = { id: 't', name: 'T', maxHp: 50, speed: 100, reward: 5, leakDamage: 1 };
const path: Vec2[] = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
];

describe('Enemy', () => {
  it('starts at the first waypoint with full hp', () => {
    const e = new Enemy(type, path);
    expect(e.pos).toEqual({ x: 0, y: 0 });
    expect(e.hp).toBe(50);
    expect(e.reachedEnd).toBe(false);
  });

  it('moves toward the next waypoint by speed * dt', () => {
    const e = new Enemy(type, path);
    e.update(0.5); // 100 * 0.5 = 50px
    expect(e.pos.x).toBeCloseTo(50);
    expect(e.pos.y).toBeCloseTo(0);
  });

  it('marks reachedEnd when it passes the final waypoint', () => {
    const e = new Enemy(type, path);
    e.update(1.5); // travels 150px, overshooting the 100px path
    expect(e.reachedEnd).toBe(true);
  });

  it('dies when hp drops to zero', () => {
    const e = new Enemy(type, path);
    e.takeDamage(50);
    expect(e.isDead).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/entities/enemy.test.ts`
Expected: FAIL — cannot resolve `enemy`.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { EnemyType } from '../config/enemies';
import type { Vec2 } from '../geometry';

export class Enemy {
  readonly type: EnemyType;
  hp: number;
  pos: Vec2;
  pathIndex: number; // index of the next waypoint to walk toward
  reachedEnd: boolean;
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
    if (this.reachedEnd) return;
    let travel = this.type.speed * dt;
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
    this.hp -= amount;
  }

  get isDead(): boolean {
    return this.hp <= 0;
  }

  /** The waypoint this enemy is currently walking toward, or null if it finished. */
  get nextWaypoint(): Vec2 | null {
    return this.pathIndex < this.path.length ? this.path[this.pathIndex] : null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/game/entities/enemy.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/game/entities/enemy.ts tests/game/entities/enemy.test.ts
git commit -m "feat: add Enemy entity with path movement and damage"
```

---

## Task 5: Tower entity

**Files:**
- Create: `src/game/entities/tower.ts`
- Test: `tests/game/entities/tower.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { Tower } from '../../../src/game/entities/tower';
import type { HeroType } from '../../../src/game/config/heroes';

const hero: HeroType = { id: 'h', name: 'H', cost: 100, range: 100, damage: 10, fireRate: 2 };

describe('Tower', () => {
  it('can fire immediately when created', () => {
    const t = new Tower(hero, { x: 0, y: 0 });
    expect(t.canFire).toBe(true);
  });

  it('cannot fire during cooldown and recovers after 1/fireRate seconds', () => {
    const t = new Tower(hero, { x: 0, y: 0 });
    t.resetCooldown(); // 1 / 2 = 0.5s
    expect(t.canFire).toBe(false);
    t.update(0.25);
    expect(t.canFire).toBe(false);
    t.update(0.25);
    expect(t.canFire).toBe(true);
  });

  it('reports whether a point is within range', () => {
    const t = new Tower(hero, { x: 0, y: 0 });
    expect(t.inRange({ x: 90, y: 0 })).toBe(true);
    expect(t.inRange({ x: 120, y: 0 })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/entities/tower.test.ts`
Expected: FAIL — cannot resolve `tower`.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { HeroType } from '../config/heroes';
import { distance, type Vec2 } from '../geometry';

export class Tower {
  readonly type: HeroType;
  readonly pos: Vec2;
  cooldown: number; // seconds remaining until it can fire

  constructor(type: HeroType, pos: Vec2) {
    this.type = type;
    this.pos = pos;
    this.cooldown = 0;
  }

  update(dt: number): void {
    this.cooldown = Math.max(0, this.cooldown - dt);
  }

  get canFire(): boolean {
    return this.cooldown <= 0;
  }

  resetCooldown(): void {
    this.cooldown = 1 / this.type.fireRate;
  }

  inRange(target: Vec2): boolean {
    return distance(this.pos, target) <= this.type.range;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/game/entities/tower.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/game/entities/tower.ts tests/game/entities/tower.test.ts
git commit -m "feat: add Tower entity with cooldown and range"
```

---

## Task 6: Economy system

**Files:**
- Create: `src/game/systems/economy.ts`
- Test: `tests/game/systems/economy.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { Economy } from '../../../src/game/systems/economy';

describe('Economy', () => {
  it('starts with the given gold', () => {
    expect(new Economy(150).gold).toBe(150);
  });

  it('spends gold when affordable and refuses when not', () => {
    const eco = new Economy(100);
    expect(eco.spend(75)).toBe(true);
    expect(eco.gold).toBe(25);
    expect(eco.spend(50)).toBe(false);
    expect(eco.gold).toBe(25);
  });

  it('earns gold', () => {
    const eco = new Economy(0);
    eco.earn(10);
    expect(eco.gold).toBe(10);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/systems/economy.test.ts`
Expected: FAIL — cannot resolve `economy`.

- [ ] **Step 3: Write minimal implementation**

```ts
export class Economy {
  gold: number;

  constructor(starting: number) {
    this.gold = starting;
  }

  canAfford(cost: number): boolean {
    return this.gold >= cost;
  }

  spend(cost: number): boolean {
    if (!this.canAfford(cost)) return false;
    this.gold -= cost;
    return true;
  }

  earn(amount: number): void {
    this.gold += amount;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/game/systems/economy.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/game/systems/economy.ts tests/game/systems/economy.test.ts
git commit -m "feat: add Economy system"
```

---

## Task 7: Game state

**Files:**
- Create: `src/game/state/gameState.ts`
- Test: `tests/game/state/gameState.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { GameState } from '../../../src/game/state/gameState';

describe('GameState', () => {
  it('starts playing with the given lives', () => {
    const s = new GameState(20);
    expect(s.lives).toBe(20);
    expect(s.status).toBe('playing');
  });

  it('loses lives and becomes lost at zero', () => {
    const s = new GameState(2);
    s.loseLife(1);
    expect(s.status).toBe('playing');
    s.loseLife(1);
    expect(s.lives).toBe(0);
    expect(s.status).toBe('lost');
  });

  it('can win only while still playing', () => {
    const s = new GameState(5);
    s.win();
    expect(s.status).toBe('won');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/state/gameState.test.ts`
Expected: FAIL — cannot resolve `gameState`.

- [ ] **Step 3: Write minimal implementation**

```ts
export type GameStatus = 'playing' | 'won' | 'lost';

export class GameState {
  lives: number;
  status: GameStatus;

  constructor(startingLives: number) {
    this.lives = startingLives;
    this.status = 'playing';
  }

  loseLife(amount: number): void {
    this.lives -= amount;
    if (this.lives <= 0) {
      this.lives = 0;
      this.status = 'lost';
    }
  }

  win(): void {
    if (this.status === 'playing') {
      this.status = 'won';
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/game/state/gameState.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/game/state/gameState.ts tests/game/state/gameState.test.ts
git commit -m "feat: add GameState (lives and win/lose status)"
```

---

## Task 8: Targeting system

Picks the enemy furthest along the path (highest `pathIndex`, tie-broken by smallest distance to its next waypoint) among enemies in range that are alive and have not leaked.

**Files:**
- Create: `src/game/systems/targeting.ts`
- Test: `tests/game/systems/targeting.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { selectTarget } from '../../../src/game/systems/targeting';
import { Tower } from '../../../src/game/entities/tower';
import { Enemy } from '../../../src/game/entities/enemy';
import type { HeroType } from '../../../src/game/config/heroes';
import type { EnemyType } from '../../../src/game/config/enemies';
import type { Vec2 } from '../../../src/game/geometry';

const hero: HeroType = { id: 'h', name: 'H', cost: 0, range: 100, damage: 10, fireRate: 1 };
const etype: EnemyType = { id: 'e', name: 'E', maxHp: 50, speed: 50, reward: 1, leakDamage: 1 };
const path: Vec2[] = [
  { x: 0, y: 0 },
  { x: 1000, y: 0 },
];

describe('selectTarget', () => {
  it('returns null when no enemy is in range', () => {
    const tower = new Tower(hero, { x: 0, y: 0 });
    const far = new Enemy(etype, path);
    far.pos = { x: 500, y: 0 };
    expect(selectTarget(tower, [far])).toBeNull();
  });

  it('chooses the enemy furthest along the path within range', () => {
    const tower = new Tower(hero, { x: 50, y: 0 });
    const behind = new Enemy(etype, path);
    behind.pos = { x: 20, y: 0 };
    const ahead = new Enemy(etype, path);
    ahead.pos = { x: 80, y: 0 };
    expect(selectTarget(tower, [behind, ahead])).toBe(ahead);
  });

  it('ignores dead and leaked enemies', () => {
    const tower = new Tower(hero, { x: 50, y: 0 });
    const dead = new Enemy(etype, path);
    dead.pos = { x: 60, y: 0 };
    dead.takeDamage(999);
    const leaked = new Enemy(etype, path);
    leaked.pos = { x: 40, y: 0 };
    leaked.reachedEnd = true;
    expect(selectTarget(tower, [dead, leaked])).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/systems/targeting.test.ts`
Expected: FAIL — cannot resolve `targeting`.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { Tower } from '../entities/tower';
import type { Enemy } from '../entities/enemy';
import { distance } from '../geometry';

export function selectTarget(tower: Tower, enemies: Enemy[]): Enemy | null {
  let best: Enemy | null = null;
  for (const e of enemies) {
    if (e.isDead || e.reachedEnd) continue;
    if (!tower.inRange(e.pos)) continue;
    if (best === null || isFurtherAlong(e, best)) {
      best = e;
    }
  }
  return best;
}

function isFurtherAlong(a: Enemy, b: Enemy): boolean {
  // A higher pathIndex means the enemy has passed more waypoints.
  if (a.pathIndex !== b.pathIndex) return a.pathIndex > b.pathIndex;
  // Same segment: whichever is closer to its next waypoint is further along.
  const an = a.nextWaypoint;
  const bn = b.nextWaypoint;
  if (an === null || bn === null) return false;
  return distance(a.pos, an) < distance(b.pos, bn);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/game/systems/targeting.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/game/systems/targeting.ts tests/game/systems/targeting.test.ts
git commit -m "feat: add targeting system (furthest-along enemy in range)"
```

---

## Task 9: Wave manager

Flattens each wave into a queue of timed spawns and emits enemy-type ids from `update(dt)`.

**Files:**
- Create: `src/game/systems/waveManager.ts`
- Test: `tests/game/systems/waveManager.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { WaveManager } from '../../../src/game/systems/waveManager';
import type { WaveConfig } from '../../../src/game/config/waves';

const waves: WaveConfig[] = [
  { spawns: [{ enemyTypeId: 'a', count: 2, interval: 1 }] },
  { spawns: [{ enemyTypeId: 'b', count: 1, interval: 1 }] },
];

describe('WaveManager', () => {
  it('reports total waves and starts before any wave', () => {
    const wm = new WaveManager(waves);
    expect(wm.totalWaves).toBe(2);
    expect(wm.currentWaveNumber).toBe(0);
    expect(wm.canStartNextWave()).toBe(true);
  });

  it('emits spawns on the configured interval', () => {
    const wm = new WaveManager(waves);
    wm.startNextWave();
    expect(wm.currentWaveNumber).toBe(1);
    expect(wm.update(1)).toEqual(['a']); // first spawn after interval
    expect(wm.update(0.5)).toEqual([]); // not yet
    expect(wm.update(0.5)).toEqual(['a']); // second spawn
    expect(wm.isSpawning).toBe(false);
  });

  it('cannot start the next wave while still spawning', () => {
    const wm = new WaveManager(waves);
    wm.startNextWave();
    wm.update(1); // one of two emitted, still spawning
    expect(wm.canStartNextWave()).toBe(false);
  });

  it('is complete after the last wave finishes spawning', () => {
    const wm = new WaveManager(waves);
    wm.startNextWave();
    wm.update(2); // drain wave 1
    wm.startNextWave();
    wm.update(1); // drain wave 2
    expect(wm.isComplete).toBe(true);
    expect(wm.hasMoreWaves).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/systems/waveManager.test.ts`
Expected: FAIL — cannot resolve `waveManager`.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { WaveConfig } from '../config/waves';

interface PendingSpawn {
  id: string;
  delay: number; // seconds to wait before emitting this spawn
}

export class WaveManager {
  private readonly waves: WaveConfig[];
  currentWaveIndex: number; // -1 before any wave starts
  private pending: PendingSpawn[];
  private timer: number;

  constructor(waves: WaveConfig[]) {
    this.waves = waves;
    this.currentWaveIndex = -1;
    this.pending = [];
    this.timer = 0;
  }

  get totalWaves(): number {
    return this.waves.length;
  }

  get currentWaveNumber(): number {
    return this.currentWaveIndex + 1; // 1-based; 0 before start
  }

  get isSpawning(): boolean {
    return this.pending.length > 0;
  }

  get hasMoreWaves(): boolean {
    return this.currentWaveIndex < this.waves.length - 1;
  }

  get isComplete(): boolean {
    return this.currentWaveIndex === this.waves.length - 1 && this.pending.length === 0;
  }

  canStartNextWave(): boolean {
    return this.hasMoreWaves && !this.isSpawning;
  }

  startNextWave(): void {
    if (!this.canStartNextWave()) return;
    this.currentWaveIndex++;
    const wave = this.waves[this.currentWaveIndex];
    this.pending = [];
    for (const spawn of wave.spawns) {
      for (let i = 0; i < spawn.count; i++) {
        this.pending.push({ id: spawn.enemyTypeId, delay: spawn.interval });
      }
    }
    this.timer = this.pending.length > 0 ? this.pending[0].delay : 0;
  }

  update(dt: number): string[] {
    const spawned: string[] = [];
    if (this.pending.length === 0) return spawned;
    this.timer -= dt;
    while (this.pending.length > 0 && this.timer <= 0) {
      const next = this.pending.shift()!;
      spawned.push(next.id);
      this.timer += this.pending.length > 0 ? this.pending[0].delay : 0;
    }
    return spawned;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/game/systems/waveManager.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/game/systems/waveManager.ts tests/game/systems/waveManager.test.ts
git commit -m "feat: add WaveManager with timed spawning"
```

---

## Task 10: World simulation

Composes every system into one `update(dt)` tick: spawn, move, fire, resolve deaths/leaks, check win/lose. This is the integration core.

**Files:**
- Create: `src/game/world.ts`
- Test: `tests/game/world.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { World } from '../../src/game/world';
import type { WorldConfig } from '../../src/game/world';
import type { LevelConfig } from '../../src/game/config/levels';
import type { EnemyType } from '../../src/game/config/enemies';
import type { HeroType } from '../../src/game/config/heroes';

const level: LevelConfig = {
  id: 'test',
  name: 'Test',
  tileSize: 48,
  cols: 10,
  rows: 4,
  path: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
  ],
  buildSpots: [{ x: 50, y: 48 }],
  startingGold: 100,
  startingLives: 1,
};
const enemyTypes: Record<string, EnemyType> = {
  a: { id: 'a', name: 'A', maxHp: 10, speed: 100, reward: 5, leakDamage: 1 },
};
const heroTypes: Record<string, HeroType> = {
  h: { id: 'h', name: 'H', cost: 50, range: 200, damage: 100, fireRate: 5 },
};

function makeConfig(): WorldConfig {
  return {
    level,
    enemyTypes,
    heroTypes,
    waves: [{ spawns: [{ enemyTypeId: 'a', count: 1, interval: 0.1 }] }],
  };
}

describe('World', () => {
  it('places a tower on a build spot and charges gold', () => {
    const w = new World(makeConfig());
    expect(w.placeTower('h', { x: 50, y: 48 })).toBe(true);
    expect(w.gold).toBe(50);
    expect(w.towers.length).toBe(1);
  });

  it('rejects tower placement off a build spot, on an occupied spot, or when broke', () => {
    const w = new World(makeConfig());
    expect(w.placeTower('h', { x: 999, y: 999 })).toBe(false);
    expect(w.placeTower('h', { x: 50, y: 48 })).toBe(true);
    expect(w.placeTower('h', { x: 50, y: 48 })).toBe(false); // occupied
    expect(w.placeTower('h', { x: 50, y: 48 })).toBe(false); // also broke now
  });

  it('lets a tower kill the spawned enemy and awards gold', () => {
    const w = new World(makeConfig());
    w.placeTower('h', { x: 50, y: 48 });
    expect(w.startNextWave()).toBe(true);
    // tick until the enemy spawns and is shot
    for (let i = 0; i < 5; i++) w.update(0.1);
    expect(w.enemies.length).toBe(0);
    expect(w.gold).toBe(55); // 100 - 50 cost + 5 reward
    expect(w.status).toBe('won');
  });

  it('loses a life and the game when an enemy leaks', () => {
    const w = new World(makeConfig()); // no tower placed
    w.startNextWave();
    for (let i = 0; i < 20; i++) w.update(0.1); // enemy walks the 100px path
    expect(w.lives).toBe(0);
    expect(w.status).toBe('lost');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/world.test.ts`
Expected: FAIL — cannot resolve `world`.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { LevelConfig } from './config/levels';
import type { EnemyType } from './config/enemies';
import type { HeroType } from './config/heroes';
import type { WaveConfig } from './config/waves';
import type { Vec2 } from './geometry';
import { Enemy } from './entities/enemy';
import { Tower } from './entities/tower';
import { Economy } from './systems/economy';
import { GameState, type GameStatus } from './state/gameState';
import { WaveManager } from './systems/waveManager';
import { selectTarget } from './systems/targeting';

export interface WorldConfig {
  level: LevelConfig;
  enemyTypes: Record<string, EnemyType>;
  heroTypes: Record<string, HeroType>;
  waves: WaveConfig[];
}

export class World {
  readonly level: LevelConfig;
  private readonly enemyTypes: Record<string, EnemyType>;
  private readonly heroTypes: Record<string, HeroType>;
  readonly economy: Economy;
  readonly state: GameState;
  readonly waveManager: WaveManager;
  enemies: Enemy[] = [];
  towers: Tower[] = [];

  constructor(cfg: WorldConfig) {
    this.level = cfg.level;
    this.enemyTypes = cfg.enemyTypes;
    this.heroTypes = cfg.heroTypes;
    this.economy = new Economy(cfg.level.startingGold);
    this.state = new GameState(cfg.level.startingLives);
    this.waveManager = new WaveManager(cfg.waves);
  }

  get gold(): number {
    return this.economy.gold;
  }
  get lives(): number {
    return this.state.lives;
  }
  get status(): GameStatus {
    return this.state.status;
  }
  get waveNumber(): number {
    return this.waveManager.currentWaveNumber;
  }
  get totalWaves(): number {
    return this.waveManager.totalWaves;
  }

  canStartNextWave(): boolean {
    return (
      this.state.status === 'playing' &&
      this.enemies.length === 0 &&
      this.waveManager.canStartNextWave()
    );
  }

  startNextWave(): boolean {
    if (!this.canStartNextWave()) return false;
    this.waveManager.startNextWave();
    return true;
  }

  placeTower(heroId: string, pos: Vec2): boolean {
    const hero = this.heroTypes[heroId];
    if (!hero) return false;
    const spot = this.level.buildSpots.find((s) => s.x === pos.x && s.y === pos.y);
    if (!spot) return false;
    if (this.towers.some((t) => t.pos.x === pos.x && t.pos.y === pos.y)) return false;
    if (!this.economy.spend(hero.cost)) return false;
    this.towers.push(new Tower(hero, { x: pos.x, y: pos.y }));
    return true;
  }

  update(dt: number): void {
    if (this.state.status !== 'playing') return;

    // 1. spawn
    for (const id of this.waveManager.update(dt)) {
      const type = this.enemyTypes[id];
      if (type) this.enemies.push(new Enemy(type, this.level.path));
    }

    // 2. move enemies
    for (const e of this.enemies) e.update(dt);

    // 3. towers fire
    for (const t of this.towers) {
      t.update(dt);
      if (t.canFire) {
        const target = selectTarget(t, this.enemies);
        if (target) {
          target.takeDamage(t.type.damage);
          t.resetCooldown();
        }
      }
    }

    // 4. resolve leaks (lose life) and deaths (reward)
    const survivors: Enemy[] = [];
    for (const e of this.enemies) {
      if (e.reachedEnd) {
        this.state.loseLife(e.type.leakDamage);
      } else if (e.isDead) {
        this.economy.earn(e.type.reward);
      } else {
        survivors.push(e);
      }
    }
    this.enemies = survivors;

    // 5. win when the last wave is fully cleared
    if (this.state.status === 'playing' && this.waveManager.isComplete && this.enemies.length === 0) {
      this.state.win();
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/game/world.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: all tests across all files PASS.

- [ ] **Step 6: Commit**

```bash
git add src/game/world.ts tests/game/world.test.ts
git commit -m "feat: add World simulation tying systems together"
```

---

## Task 11: Local save (best wave)

Uses an injectable storage interface so it is testable without a browser.

**Files:**
- Create: `src/services/localSave.ts`
- Test: `tests/services/localSave.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { loadSave, saveBestWave, type StorageLike } from '../../src/services/localSave';

function fakeStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
  };
}

describe('localSave', () => {
  it('returns bestWave 0 when nothing is stored', () => {
    expect(loadSave(fakeStorage())).toEqual({ bestWave: 0 });
  });

  it('persists a new best wave but not a worse one', () => {
    const store = fakeStorage();
    saveBestWave(3, store);
    expect(loadSave(store).bestWave).toBe(3);
    saveBestWave(2, store);
    expect(loadSave(store).bestWave).toBe(3);
    saveBestWave(5, store);
    expect(loadSave(store).bestWave).toBe(5);
  });

  it('recovers gracefully from corrupt data', () => {
    const store = fakeStorage();
    store.setItem('bayani-td-save', 'not json');
    expect(loadSave(store)).toEqual({ bestWave: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/services/localSave.test.ts`
Expected: FAIL — cannot resolve `localSave`.

- [ ] **Step 3: Write minimal implementation**

```ts
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface SaveData {
  bestWave: number;
}

const KEY = 'bayani-td-save';

function defaultStorage(): StorageLike {
  return globalThis.localStorage;
}

export function loadSave(storage: StorageLike = defaultStorage()): SaveData {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return { bestWave: 0 };
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    return { bestWave: typeof parsed.bestWave === 'number' ? parsed.bestWave : 0 };
  } catch {
    return { bestWave: 0 };
  }
}

export function saveBestWave(wave: number, storage: StorageLike = defaultStorage()): void {
  const current = loadSave(storage);
  if (wave > current.bestWave) {
    storage.setItem(KEY, JSON.stringify({ bestWave: wave }));
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/services/localSave.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/localSave.ts tests/services/localSave.test.ts
git commit -m "feat: add local best-wave persistence"
```

---

## Task 12: GameScene (rendering, input, sim loop)

Immediate-mode rendering each frame. Controls: **1** = Lapu-Lapu, **2** = Gabriela, **click a build spot** to place the selected hero, **SPACE** = start next wave, **R** = restart after game over.

**Files:**
- Create: `src/scenes/GameScene.ts`

- [ ] **Step 1: Create `src/scenes/GameScene.ts`**

```ts
import Phaser from 'phaser';
import { World } from '../game/world';
import { LEVEL_ONE } from '../game/config/levels';
import { ENEMY_TYPES } from '../game/config/enemies';
import { HERO_TYPES } from '../game/config/heroes';
import { WAVES } from '../game/config/waves';
import { loadSave, saveBestWave } from '../services/localSave';
import type { Vec2 } from '../game/geometry';

const HERO_COLORS: Record<string, number> = {
  lapulapu: 0xffcf5c,
  gabriela: 0x5cc7ff,
};
const ENEMY_COLORS: Record<string, number> = {
  aswang: 0xc0392b,
  tiktik: 0x8e44ad,
};

export class GameScene extends Phaser.Scene {
  private world!: World;
  private gfx!: Phaser.GameObjects.Graphics;
  private hudText!: Phaser.GameObjects.Text;
  private overlayText!: Phaser.GameObjects.Text;
  private selectedHeroId = 'lapulapu';
  private bestWave = 0;
  private endHandled = false;

  constructor() {
    super('Game');
  }

  create(): void {
    this.world = new World({
      level: LEVEL_ONE,
      enemyTypes: ENEMY_TYPES,
      heroTypes: HERO_TYPES,
      waves: WAVES,
    });
    this.bestWave = loadSave().bestWave;
    this.endHandled = false;

    this.gfx = this.add.graphics();

    this.hudText = this.add
      .text(8, 8, '', { fontFamily: 'monospace', fontSize: '14px', color: '#ffffff' })
      .setDepth(10);

    this.overlayText = this.add
      .text(LEVEL_ONE.cols * LEVEL_ONE.tileSize / 2, LEVEL_ONE.rows * LEVEL_ONE.tileSize / 2, '', {
        fontFamily: 'monospace',
        fontSize: '32px',
        color: '#ffffff',
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(10);

    this.input.keyboard?.on('keydown-ONE', () => (this.selectedHeroId = 'lapulapu'));
    this.input.keyboard?.on('keydown-TWO', () => (this.selectedHeroId = 'gabriela'));
    this.input.keyboard?.on('keydown-SPACE', () => this.world.startNextWave());
    this.input.keyboard?.on('keydown-R', () => {
      if (this.world.status !== 'playing') this.scene.restart();
    });

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.tryPlaceTower(p.x, p.y));
  }

  private tryPlaceTower(x: number, y: number): void {
    if (this.world.status !== 'playing') return;
    const spot = this.nearestBuildSpot({ x, y });
    if (spot) this.world.placeTower(this.selectedHeroId, spot);
  }

  private nearestBuildSpot(p: Vec2): Vec2 | null {
    const half = LEVEL_ONE.tileSize / 2;
    for (const s of LEVEL_ONE.buildSpots) {
      if (Math.abs(s.x - p.x) <= half && Math.abs(s.y - p.y) <= half) return s;
    }
    return null;
  }

  update(_time: number, delta: number): void {
    if (this.world.status === 'playing') {
      this.world.update(delta / 1000);
    }
    this.draw();
    this.updateHud();
    this.handleEndState();
  }

  private draw(): void {
    const g = this.gfx;
    g.clear();

    // path
    g.lineStyle(LEVEL_ONE.tileSize * 0.6, 0x3a2c1f, 1);
    g.beginPath();
    const path = LEVEL_ONE.path;
    g.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) g.lineTo(path[i].x, path[i].y);
    g.strokePath();

    // build spots
    for (const s of LEVEL_ONE.buildSpots) {
      g.fillStyle(0x2e4a32, 1);
      g.fillRect(s.x - 18, s.y - 18, 36, 36);
    }

    // towers + range
    for (const t of this.world.towers) {
      g.fillStyle(0x000000, 0.12);
      g.fillCircle(t.pos.x, t.pos.y, t.type.range);
      g.fillStyle(HERO_COLORS[t.type.id] ?? 0xffffff, 1);
      g.fillCircle(t.pos.x, t.pos.y, 14);
    }

    // enemies + hp bar
    for (const e of this.world.enemies) {
      g.fillStyle(ENEMY_COLORS[e.type.id] ?? 0xffffff, 1);
      g.fillCircle(e.pos.x, e.pos.y, 10);
      const frac = Math.max(0, e.hp / e.type.maxHp);
      g.fillStyle(0x000000, 0.6);
      g.fillRect(e.pos.x - 11, e.pos.y - 18, 22, 4);
      g.fillStyle(0x2ecc71, 1);
      g.fillRect(e.pos.x - 11, e.pos.y - 18, 22 * frac, 4);
    }
  }

  private updateHud(): void {
    const w = this.world;
    const hero = HERO_TYPES[this.selectedHeroId];
    this.hudText.setText(
      [
        `Gold: ${w.gold}   Lives: ${w.lives}   Wave: ${w.waveNumber}/${w.totalWaves}   Best: ${this.bestWave}`,
        `Selected: ${hero.name} ($${hero.cost})   [1] Lapu-Lapu  [2] Gabriela   [SPACE] start wave`,
      ].join('\n'),
    );
  }

  private handleEndState(): void {
    if (this.world.status === 'playing' || this.endHandled) return;
    this.endHandled = true;
    const reached = this.world.waveNumber;
    saveBestWave(reached);
    this.bestWave = Math.max(this.bestWave, reached);
    const msg = this.world.status === 'won' ? 'VICTORY!' : 'DEFEAT';
    this.overlayText.setText(`${msg}\nReached wave ${reached}\nPress R to restart`);
  }
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/GameScene.ts
git commit -m "feat: add GameScene with rendering, input, and sim loop"
```

---

## Task 13: Wire scenes into the game and verify end-to-end

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Replace `src/main.ts`**

```ts
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { LEVEL_ONE } from './game/config/levels';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: LEVEL_ONE.cols * LEVEL_ONE.tileSize,
  height: LEVEL_ONE.rows * LEVEL_ONE.tileSize,
  backgroundColor: '#1d2b1f',
  pixelArt: true,
  parent: 'game',
  scene: [BootScene, GameScene],
};

new Phaser.Game(config);
```

- [ ] **Step 2: Full type-check and test pass**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; all unit tests PASS.

- [ ] **Step 3: Manual playtest**

Run: `npm run dev`, open the URL, and confirm:
- The path, build spots, and HUD render.
- Press **1**, click a build spot → a yellow tower appears with a range ring and gold drops by 100.
- Press **SPACE** → enemies spawn and walk the path; towers in range shoot them and gold rises on kills.
- Let enemies leak → Lives decreases.
- Clear all 3 waves → "VICTORY!" overlay; or lose all lives → "DEFEAT". Press **R** to restart. Best wave persists across restarts.

- [ ] **Step 4: Production build sanity check**

Run: `npm run build`
Expected: `tsc --noEmit` passes and Vite writes `dist/` with no errors.

- [ ] **Step 5: Commit**

```bash
git add src/main.ts
git commit -m "feat: wire BootScene + GameScene into a playable build"
```

---

## Definition of Done

- All Vitest suites pass (`npm test`).
- `npm run build` succeeds.
- The manual playtest in Task 13 Step 3 passes every bullet: place towers, start waves, kill/leak, win/lose, restart, persistent best wave.
- The game is playable end-to-end with placeholder graphics — ready for Phase 2 (content + real pixel art + Tiled).
