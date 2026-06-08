# Bayani TD — Phase 2 Art Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder shapes with an animated pixel-art pipeline — sprite sheets (idle/walk/attack/death) for the 4 characters, a tiled map background, and combat FX (projectile, hit puff, death, tower fire) — driven by a fixed asset manifest with committed placeholder art that real art later overwrites.

**Architecture:** Pure game logic (`src/game/`) is untouched except one additive change: `World` accumulates per-tick `events` (shots, deaths) for the view layer to animate. Everything else is presentation: a manifest (`src/assets/`), a `PreloadScene`, an animation registry, entity view classes that sync logic entities → Phaser sprites, a map renderer, and FX helpers, integrated by `GameScene`. A committed Node script generates placeholder sprite-sheet PNGs matching the manifest so the game runs before real art exists.

**Tech Stack:** TypeScript (strict), Phaser 3, Vite, Vitest, pngjs (dev-only, placeholder generation).

**Reference spec:** `docs/superpowers/specs/2026-06-09-bayani-td-phase2-art-design.md`

---

## File Structure

New:
- `src/assets/manifest.ts` — `AssetManifest` types + `MANIFEST` (the contract: keys, paths, frame dims, anim ranges)
- `scripts/gen-placeholders.mjs` — Node script writing placeholder PNGs to `public/assets/`
- `public/assets/sprites/{lapulapu,gabriela,aswang,tiktik}.png` — generated placeholder character sheets
- `public/assets/fx/{projectile,hit-puff}.png` — generated placeholder FX
- `public/assets/map/{ground,path-tile,build-marker}.png` — generated placeholder map art
- `src/scenes/PreloadScene.ts` — loads manifest assets, registers anims, starts Game
- `src/render/animations.ts` — `registerAnimations(scene)` from manifest
- `src/render/mapRenderer.ts` — `renderMap(scene, level)` (ground + path + build markers)
- `src/render/enemyView.ts` — `EnemyView` (Enemy → sprite)
- `src/render/towerView.ts` — `TowerView` (Tower → sprite)
- `src/render/fx.ts` — `spawnProjectile`, `spawnHitPuff`, `spawnDeath`
- `tests/assets/manifest.test.ts`, `tests/game/world-events.test.ts`

Modified:
- `src/game/world.ts` — additive `events` accumulator
- `src/scenes/BootScene.ts` — start `'Preload'` instead of `'Game'`
- `src/main.ts` — add `PreloadScene` to the scene list
- `src/scenes/GameScene.ts` — use views + map + FX; keep HUD + a thin HP-bar graphics layer
- `package.json` — add `pngjs` devDep + `gen:placeholders` script

Logic tasks (1, 3) use TDD. Presentation tasks (2, 4–8) are verified by `npx tsc --noEmit`, `npm run build`, and a manual run.

---

## Task 1: Asset manifest + validation test

**Files:**
- Create: `src/assets/manifest.ts`
- Test: `tests/assets/manifest.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { MANIFEST } from '../../src/assets/manifest';

describe('asset manifest', () => {
  it('has the four expected characters with unique keys', () => {
    const keys = MANIFEST.characters.map((c) => c.key).sort();
    expect(keys).toEqual(['aswang', 'gabriela', 'lapulapu', 'tiktik']);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('defines idle/walk/attack/death within frame bounds for each character', () => {
    for (const c of MANIFEST.characters) {
      expect(c.frameCount).toBeGreaterThan(0);
      for (const state of ['idle', 'walk', 'attack', 'death'] as const) {
        const a = c.anims[state];
        expect(a.start).toBeGreaterThanOrEqual(0);
        expect(a.end).toBeGreaterThanOrEqual(a.start);
        expect(a.end).toBeLessThan(c.frameCount);
        expect(a.frameRate).toBeGreaterThan(0);
      }
    }
  });

  it('points every asset path under assets/', () => {
    const paths = [
      ...MANIFEST.characters.map((c) => c.path),
      MANIFEST.fx.projectile.path,
      MANIFEST.fx.hitPuff.path,
      MANIFEST.map.ground.path,
      MANIFEST.map.pathTile.path,
      MANIFEST.map.buildMarker.path,
    ];
    for (const p of paths) expect(p.startsWith('assets/')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/assets/manifest.test.ts`
Expected: FAIL — cannot resolve `manifest`.

- [ ] **Step 3: Write the implementation**

```ts
export interface AnimSpec {
  start: number;
  end: number;
  frameRate: number;
  repeat: number; // -1 = loop, 0 = play once
}

export interface CharacterAsset {
  key: string;
  path: string;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  anims: { idle: AnimSpec; walk: AnimSpec; attack: AnimSpec; death: AnimSpec };
}

export interface SheetAsset {
  key: string;
  path: string;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
}

export interface ImageAsset {
  key: string;
  path: string;
}

export interface AssetManifest {
  characters: CharacterAsset[];
  fx: { projectile: ImageAsset; hitPuff: SheetAsset };
  map: { ground: ImageAsset; pathTile: ImageAsset; buildMarker: ImageAsset };
}

// Frame layout per character sheet (13 frames, 32x32):
//   idle 0-1 | walk 2-5 | attack 6-8 | death 9-12
function character(key: string): CharacterAsset {
  return {
    key,
    path: `assets/sprites/${key}.png`,
    frameWidth: 32,
    frameHeight: 32,
    frameCount: 13,
    anims: {
      idle: { start: 0, end: 1, frameRate: 4, repeat: -1 },
      walk: { start: 2, end: 5, frameRate: 8, repeat: -1 },
      attack: { start: 6, end: 8, frameRate: 12, repeat: 0 },
      death: { start: 9, end: 12, frameRate: 10, repeat: 0 },
    },
  };
}

export const MANIFEST: AssetManifest = {
  characters: [character('lapulapu'), character('gabriela'), character('aswang'), character('tiktik')],
  fx: {
    projectile: { key: 'projectile', path: 'assets/fx/projectile.png' },
    hitPuff: { key: 'hit-puff', path: 'assets/fx/hit-puff.png', frameWidth: 16, frameHeight: 16, frameCount: 4 },
  },
  map: {
    ground: { key: 'ground', path: 'assets/map/ground.png' },
    pathTile: { key: 'path-tile', path: 'assets/map/path-tile.png' },
    buildMarker: { key: 'build-marker', path: 'assets/map/build-marker.png' },
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/assets/manifest.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/assets/manifest.ts tests/assets/manifest.test.ts
git commit -m "feat: add asset manifest for Phase 2 art pipeline"
```

---

## Task 2: Placeholder art generator

Generates committed placeholder PNGs matching the manifest so the game runs before real art exists. Uses `pngjs` (pure-JS, no native deps).

**Files:**
- Modify: `package.json` (add devDep + script)
- Create: `scripts/gen-placeholders.mjs`
- Create (generated): the PNGs under `public/assets/`

- [ ] **Step 1: Add pngjs and a script to `package.json`**

In `"devDependencies"` add `"pngjs": "^7.0.0"`. In `"scripts"` add:

```json
"gen:placeholders": "node scripts/gen-placeholders.mjs"
```

Then run: `npm install`
Expected: pngjs installed.

- [ ] **Step 2: Create `scripts/gen-placeholders.mjs`**

```js
import { PNG } from 'pngjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

// Writes a horizontal sprite sheet. colorFn(frame, x, y, w, h) -> [r,g,b,a].
function writeSheet(path, frameW, frameH, frameCount, colorFn) {
  const png = new PNG({ width: frameW * frameCount, height: frameH });
  for (let y = 0; y < frameH; y++) {
    for (let x = 0; x < png.width; x++) {
      const frame = Math.floor(x / frameW);
      const fx = x % frameW;
      const [r, g, b, a] = colorFn(frame, fx, y, frameW, frameH);
      const i = (png.width * y + x) << 2;
      png.data[i] = r;
      png.data[i + 1] = g;
      png.data[i + 2] = b;
      png.data[i + 3] = a;
    }
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, PNG.sync.write(png));
  console.log('wrote', path);
}

// Character sheet: solid body with a transparent 1px edge and a white bar that
// moves with the frame index so the animation is visibly different per frame.
function characterColorFn([r, g, b]) {
  return (frame, x, y, w, h) => {
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1) return [0, 0, 0, 0];
    const barY = 5 + (frame % 4) * 5;
    if (y >= barY && y < barY + 3 && x >= 8 && x < w - 8) return [255, 255, 255, 255];
    return [r, g, b, 255];
  };
}

// Hit puff: expanding white ring over 4 frames on transparent bg.
function puffColorFn(frame, x, y, w, h) {
  const cx = w / 2 - 0.5;
  const cy = h / 2 - 0.5;
  const dist = Math.hypot(x - cx, y - cy);
  const radius = 2 + frame * 3;
  return Math.abs(dist - radius) < 1.5 ? [255, 240, 180, 255] : [0, 0, 0, 0];
}

const CHARS = {
  lapulapu: [0xff, 0xcf, 0x5c],
  gabriela: [0x5c, 0xc7, 0xff],
  aswang: [0xc0, 0x39, 0x2b],
  tiktik: [0x8e, 0x44, 0xad],
};

for (const [key, color] of Object.entries(CHARS)) {
  writeSheet(`public/assets/sprites/${key}.png`, 32, 32, 13, characterColorFn(color));
}

writeSheet(`public/assets/fx/hit-puff.png`, 16, 16, 4, puffColorFn);
writeSheet(`public/assets/fx/projectile.png`, 8, 8, 1, (_f, x, y, w, h) => {
  const d = Math.hypot(x - (w / 2 - 0.5), y - (h / 2 - 0.5));
  return d < 3 ? [255, 230, 120, 255] : [0, 0, 0, 0];
});

// Map tiles (32x32). Ground = green w/ subtle checker; path = brown; build = faint outline.
writeSheet(`public/assets/map/ground.png`, 32, 32, 1, (_f, x, y) => {
  const shade = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0 ? 0 : 12;
  return [40 + shade, 74 + shade, 50 + shade, 255];
});
writeSheet(`public/assets/map/path-tile.png`, 32, 32, 1, (_f, x, y) => {
  const shade = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0 ? 0 : 14;
  return [90 + shade, 70 + shade, 48 + shade, 255];
});
writeSheet(`public/assets/map/build-marker.png`, 32, 32, 1, (_f, x, y, w, h) => {
  const edge = x < 2 || y < 2 || x >= w - 2 || y >= h - 2;
  return edge ? [120, 200, 130, 180] : [0, 0, 0, 0];
});
```

- [ ] **Step 3: Generate the placeholder PNGs**

Run: `npm run gen:placeholders`
Expected: console prints `wrote public/assets/...` for all 9 files; the files exist.

- [ ] **Step 4: Commit (including the generated PNGs)**

```bash
git add package.json package-lock.json scripts/gen-placeholders.mjs public/assets
git commit -m "feat: add placeholder art generator and generated sprite sheets"
```

---

## Task 3: World per-tick events (logic, TDD)

Additive change so the view layer can animate shots and deaths. Existing behavior and tests are unchanged.

**Files:**
- Modify: `src/game/world.ts`
- Test: `tests/game/world-events.test.ts`

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

describe('World events', () => {
  it('starts with empty event buffers', () => {
    const w = new World(makeConfig());
    expect(w.events.shots).toEqual([]);
    expect(w.events.deaths).toEqual([]);
  });

  it('records a shot (from tower to target) and a death when the enemy is killed', () => {
    const w = new World(makeConfig());
    w.placeTower('h', { x: 50, y: 48 });
    w.startNextWave();
    let sawShot = false;
    let sawDeath = false;
    for (let i = 0; i < 5; i++) {
      w.update(0.1);
      if (w.events.shots.length > 0) {
        sawShot = true;
        expect(w.events.shots[0].heroId).toBe('h');
        expect(w.events.shots[0].from).toEqual({ x: 50, y: 48 });
      }
      if (w.events.deaths.length > 0) {
        sawDeath = true;
        expect(w.events.deaths[0].enemyTypeId).toBe('a');
      }
    }
    expect(sawShot).toBe(true);
    expect(sawDeath).toBe(true);
  });

  it('clears event buffers each tick', () => {
    const w = new World(makeConfig()); // no tower, no wave started
    w.update(0.1);
    expect(w.events.shots).toEqual([]);
    expect(w.events.deaths).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/world-events.test.ts`
Expected: FAIL — `w.events` is undefined.

- [ ] **Step 3: Modify `src/game/world.ts`**

Add these exported interfaces near the top (after the existing imports, before `WorldConfig`):

```ts
export interface ShotEvent {
  from: Vec2;
  to: Vec2;
  heroId: string;
}

export interface DeathEvent {
  pos: Vec2;
  enemyTypeId: string;
}

export interface WorldEvents {
  shots: ShotEvent[];
  deaths: DeathEvent[];
}
```

Add the field to the class (alongside `enemies`/`towers`):

```ts
  readonly events: WorldEvents = { shots: [], deaths: [] };
```

Replace the body of `update(dt)` with this version (clears events first, records shots in the fire step, records deaths in the resolve step — all else identical):

```ts
  update(dt: number): void {
    this.events.shots = [];
    this.events.deaths = [];
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
          this.events.shots.push({
            from: { x: t.pos.x, y: t.pos.y },
            to: { x: target.pos.x, y: target.pos.y },
            heroId: t.type.id,
          });
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
        this.events.deaths.push({ pos: { x: e.pos.x, y: e.pos.y }, enemyTypeId: e.type.id });
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/game/world-events.test.ts tests/game/world.test.ts`
Expected: PASS — new events tests pass AND the original 4 World tests still pass.

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: all tests PASS (35 total: 29 original + 3 manifest + 3 world-events; confirm no regressions).

- [ ] **Step 6: Commit**

```bash
git add src/game/world.ts tests/game/world-events.test.ts
git commit -m "feat: add per-tick World events (shots, deaths) for FX"
```

---

## Task 4: PreloadScene + animation registry + scene wiring

**Files:**
- Create: `src/render/animations.ts`, `src/scenes/PreloadScene.ts`
- Modify: `src/scenes/BootScene.ts`, `src/main.ts`

- [ ] **Step 1: Create `src/render/animations.ts`**

```ts
import Phaser from 'phaser';
import { MANIFEST } from '../assets/manifest';

export function registerAnimations(scene: Phaser.Scene): void {
  for (const c of MANIFEST.characters) {
    for (const state of ['idle', 'walk', 'attack', 'death'] as const) {
      const spec = c.anims[state];
      scene.anims.create({
        key: `${c.key}-${state}`,
        frames: scene.anims.generateFrameNumbers(c.key, { start: spec.start, end: spec.end }),
        frameRate: spec.frameRate,
        repeat: spec.repeat,
      });
    }
  }
  const hp = MANIFEST.fx.hitPuff;
  scene.anims.create({
    key: hp.key,
    frames: scene.anims.generateFrameNumbers(hp.key, { start: 0, end: hp.frameCount - 1 }),
    frameRate: 20,
    repeat: 0,
  });
}
```

- [ ] **Step 2: Create `src/scenes/PreloadScene.ts`**

```ts
import Phaser from 'phaser';
import { MANIFEST } from '../assets/manifest';
import { registerAnimations } from '../render/animations';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload(): void {
    this.add
      .text(this.scale.width / 2, this.scale.height / 2, 'Loading…', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    for (const c of MANIFEST.characters) {
      this.load.spritesheet(c.key, c.path, { frameWidth: c.frameWidth, frameHeight: c.frameHeight });
    }
    this.load.image(MANIFEST.fx.projectile.key, MANIFEST.fx.projectile.path);
    this.load.spritesheet(MANIFEST.fx.hitPuff.key, MANIFEST.fx.hitPuff.path, {
      frameWidth: MANIFEST.fx.hitPuff.frameWidth,
      frameHeight: MANIFEST.fx.hitPuff.frameHeight,
    });
    this.load.image(MANIFEST.map.ground.key, MANIFEST.map.ground.path);
    this.load.image(MANIFEST.map.pathTile.key, MANIFEST.map.pathTile.path);
    this.load.image(MANIFEST.map.buildMarker.key, MANIFEST.map.buildMarker.path);
  }

  create(): void {
    registerAnimations(this);
    this.scene.start('Game');
  }
}
```

- [ ] **Step 3: Modify `src/scenes/BootScene.ts`** — change the start target from `'Game'` to `'Preload'`:

```ts
import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.scene.start('Preload');
  }
}
```

- [ ] **Step 4: Modify `src/main.ts`** — import and register `PreloadScene` between Boot and Game:

```ts
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { GameScene } from './scenes/GameScene';
import { LEVEL_ONE } from './game/config/levels';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: LEVEL_ONE.cols * LEVEL_ONE.tileSize,
  height: LEVEL_ONE.rows * LEVEL_ONE.tileSize,
  backgroundColor: '#1d2b1f',
  pixelArt: true,
  parent: 'game',
  scene: [BootScene, PreloadScene, GameScene],
};

new Phaser.Game(config);
```

- [ ] **Step 5: Type-check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: no type errors; build writes `dist/` cleanly.

- [ ] **Step 6: Commit**

```bash
git add src/render/animations.ts src/scenes/PreloadScene.ts src/scenes/BootScene.ts src/main.ts
git commit -m "feat: add PreloadScene and animation registry"
```

---

## Task 5: Map renderer

**Files:**
- Create: `src/render/mapRenderer.ts`

- [ ] **Step 1: Create `src/render/mapRenderer.ts`**

```ts
import Phaser from 'phaser';
import type { LevelConfig } from '../game/config/levels';
import { MANIFEST } from '../assets/manifest';

// Draws the ground, a tiled path strip along the waypoints, and build markers.
export function renderMap(scene: Phaser.Scene, level: LevelConfig): void {
  const width = level.cols * level.tileSize;
  const height = level.rows * level.tileSize;

  scene.add
    .tileSprite(0, 0, width, height, MANIFEST.map.ground.key)
    .setOrigin(0, 0)
    .setDepth(-20);

  const step = level.tileSize / 2;
  for (let i = 1; i < level.path.length; i++) {
    const a = level.path[i - 1];
    const b = level.path[i];
    const segLen = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
    const count = Math.max(1, Math.ceil(segLen / step));
    for (let s = 0; s <= count; s++) {
      const t = s / count;
      const x = Phaser.Math.Linear(a.x, b.x, t);
      const y = Phaser.Math.Linear(a.y, b.y, t);
      scene.add.image(x, y, MANIFEST.map.pathTile.key).setDepth(-15);
    }
  }

  for (const spot of level.buildSpots) {
    scene.add.image(spot.x, spot.y, MANIFEST.map.buildMarker.key).setDepth(-10);
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. (Not wired into a scene yet; integrated in Task 8.)

- [ ] **Step 3: Commit**

```bash
git add src/render/mapRenderer.ts
git commit -m "feat: add map renderer (ground, path, build markers)"
```

---

## Task 6: Entity view layer

**Files:**
- Create: `src/render/enemyView.ts`, `src/render/towerView.ts`

- [ ] **Step 1: Create `src/render/enemyView.ts`**

```ts
import Phaser from 'phaser';
import type { Enemy } from '../game/entities/enemy';

export class EnemyView {
  readonly sprite: Phaser.GameObjects.Sprite;
  private lastX: number;

  constructor(scene: Phaser.Scene, enemy: Enemy) {
    this.sprite = scene.add.sprite(enemy.pos.x, enemy.pos.y, enemy.type.id).setDepth(5);
    this.sprite.play(`${enemy.type.id}-walk`);
    this.lastX = enemy.pos.x;
  }

  sync(enemy: Enemy): void {
    const dx = enemy.pos.x - this.lastX;
    if (Math.abs(dx) > 0.01) this.sprite.setFlipX(dx < 0);
    this.lastX = enemy.pos.x;
    this.sprite.setPosition(enemy.pos.x, enemy.pos.y);
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
```

- [ ] **Step 2: Create `src/render/towerView.ts`**

```ts
import Phaser from 'phaser';
import type { Tower } from '../game/entities/tower';

export class TowerView {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly key: string;

  constructor(scene: Phaser.Scene, tower: Tower) {
    this.key = tower.type.id;
    this.sprite = scene.add.sprite(tower.pos.x, tower.pos.y, this.key).setDepth(6);
    this.sprite.play(`${this.key}-idle`);
  }

  playAttack(targetX: number): void {
    this.sprite.setFlipX(targetX < this.sprite.x);
    this.sprite.play(`${this.key}-attack`, true);
    this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.sprite.play(`${this.key}-idle`);
    });
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/render/enemyView.ts src/render/towerView.ts
git commit -m "feat: add Enemy and Tower view classes"
```

---

## Task 7: FX helpers

**Files:**
- Create: `src/render/fx.ts`

- [ ] **Step 1: Create `src/render/fx.ts`**

```ts
import Phaser from 'phaser';
import type { Vec2 } from '../game/geometry';
import { MANIFEST } from '../assets/manifest';

export function spawnProjectile(scene: Phaser.Scene, from: Vec2, to: Vec2): void {
  const p = scene.add.image(from.x, from.y, MANIFEST.fx.projectile.key).setDepth(7);
  scene.tweens.add({
    targets: p,
    x: to.x,
    y: to.y,
    duration: 120,
    onComplete: () => p.destroy(),
  });
}

export function spawnHitPuff(scene: Phaser.Scene, at: Vec2): void {
  const s = scene.add.sprite(at.x, at.y, MANIFEST.fx.hitPuff.key).setDepth(8);
  s.play(MANIFEST.fx.hitPuff.key);
  s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => s.destroy());
}

export function spawnDeath(scene: Phaser.Scene, enemyTypeId: string, at: Vec2): void {
  const s = scene.add.sprite(at.x, at.y, enemyTypeId).setDepth(4);
  s.play(`${enemyTypeId}-death`);
  s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => s.destroy());
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/render/fx.ts
git commit -m "feat: add projectile, hit-puff, and death FX helpers"
```

---

## Task 8: GameScene integration

Swap immediate-mode entity drawing for the map renderer, entity views, and event-driven FX. Keep the HUD and a thin graphics layer for HP bars.

**Files:**
- Modify: `src/scenes/GameScene.ts`

- [ ] **Step 1: Replace `src/scenes/GameScene.ts` with:**

```ts
import Phaser from 'phaser';
import { World } from '../game/world';
import { LEVEL_ONE } from '../game/config/levels';
import { ENEMY_TYPES } from '../game/config/enemies';
import { HERO_TYPES } from '../game/config/heroes';
import { WAVES } from '../game/config/waves';
import { loadSave, saveBestWave } from '../services/localSave';
import type { Vec2 } from '../game/geometry';
import type { Enemy } from '../game/entities/enemy';
import type { Tower } from '../game/entities/tower';
import { renderMap } from '../render/mapRenderer';
import { EnemyView } from '../render/enemyView';
import { TowerView } from '../render/towerView';
import { spawnProjectile, spawnHitPuff, spawnDeath } from '../render/fx';

export class GameScene extends Phaser.Scene {
  private world!: World;
  private hpBars!: Phaser.GameObjects.Graphics;
  private hudText!: Phaser.GameObjects.Text;
  private overlayText!: Phaser.GameObjects.Text;
  private selectedHeroId = 'lapulapu';
  private bestWave = 0;
  private endHandled = false;
  private enemyViews = new Map<Enemy, EnemyView>();
  private towerViews = new Map<Tower, TowerView>();

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
    this.enemyViews.clear();
    this.towerViews.clear();

    renderMap(this, LEVEL_ONE);
    this.hpBars = this.add.graphics().setDepth(9);

    this.hudText = this.add
      .text(8, 8, '', { fontFamily: 'monospace', fontSize: '14px', color: '#ffffff' })
      .setDepth(20);

    this.overlayText = this.add
      .text(this.scale.width / 2, this.scale.height / 2, '', {
        fontFamily: 'monospace',
        fontSize: '32px',
        color: '#ffffff',
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(20);

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
    this.consumeEvents();
    this.syncViews();
    this.drawHpBars();
    this.updateHud();
    this.handleEndState();
  }

  private consumeEvents(): void {
    for (const shot of this.world.events.shots) {
      for (const view of this.towerViews.values()) {
        if (view.sprite.x === shot.from.x && view.sprite.y === shot.from.y) {
          view.playAttack(shot.to.x);
        }
      }
      spawnProjectile(this, shot.from, shot.to);
      spawnHitPuff(this, shot.to);
    }
    for (const death of this.world.events.deaths) {
      spawnDeath(this, death.enemyTypeId, death.pos);
    }
  }

  private syncViews(): void {
    // towers (only ever added)
    for (const t of this.world.towers) {
      let view = this.towerViews.get(t);
      if (!view) {
        view = new TowerView(this, t);
        this.towerViews.set(t, view);
      }
    }
    // enemies: add new, sync existing, remove gone
    const live = new Set(this.world.enemies);
    for (const e of this.world.enemies) {
      let view = this.enemyViews.get(e);
      if (!view) {
        view = new EnemyView(this, e);
        this.enemyViews.set(e, view);
      }
      view.sync(e);
    }
    for (const [e, view] of this.enemyViews) {
      if (!live.has(e)) {
        view.destroy();
        this.enemyViews.delete(e);
      }
    }
  }

  private drawHpBars(): void {
    const g = this.hpBars;
    g.clear();
    for (const e of this.world.enemies) {
      const frac = Math.max(0, e.hp / e.type.maxHp);
      g.fillStyle(0x000000, 0.6);
      g.fillRect(e.pos.x - 11, e.pos.y - 22, 22, 4);
      g.fillStyle(0x2ecc71, 1);
      g.fillRect(e.pos.x - 11, e.pos.y - 22, 22 * frac, 4);
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

- [ ] **Step 2: Type-check, test, build**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: no type errors; all unit tests pass; build writes `dist/` cleanly.

- [ ] **Step 3: Manual playtest**

Run: `npm run dev`, open the URL, and confirm:
- The ground + tiled path + build markers render (no more plain line).
- Build spots show markers; clicking one places an animated hero sprite that idles.
- SPACE spawns animated enemy sprites that walk the path (flipping to face direction).
- A tower firing plays its attack animation; a projectile flies to the enemy; a hit puff appears; HP bars deplete.
- Killing an enemy plays a death animation; clearing all waves shows VICTORY, losing shows DEFEAT; R restarts.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/GameScene.ts
git commit -m "feat: render animated sprites, map, and FX in GameScene"
```

---

## Definition of Done

- `npm test` passes (logic + manifest + world-events; ~35 tests).
- `npm run build` succeeds.
- The game renders animated (placeholder) sprites for heroes/enemies, a tiled map, and combat FX, driven by `World.events`.
- Real art can replace `public/assets/**` PNGs with no code change (same keys/dimensions/frame counts).

## Parallel (non-code) track: real art production

Not a coded task — done alongside/after: source animated CC0 character packs, theme them in Aseprite, use ChatGPT (via Browser MCP) for accents, and overwrite the placeholder PNGs (keeping the manifest's dimensions/frame counts). If frame counts change, update `MANIFEST` and `scripts/gen-placeholders.mjs` together.
