# Bayani TD — Real Art Slice A (3/4 view) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the renderer to a 3/4 top-down look — directional sprite facing, depth-sorting by y, feet-anchored scaling — via a directional asset manifest, and prove real animated art by integrating one LPC character end-to-end.

**Architecture:** Pure game logic (`src/game/`) and its 35 tests are untouched. The manifest grows to per-character/per-direction clips; Preload/animations/views/GameScene are updated for facing + depth-sort + scale. Placeholder sheets are re-expressed in the new schema so the game stays runnable; one character is then swapped to a real LPC universal-layout sheet.

**Tech Stack:** TypeScript (strict), Phaser 3, Vite, Vitest. Art: LPC (CC-BY-SA), fetched via curl.

**Reference spec:** `docs/superpowers/specs/2026-06-09-bayani-td-phase2-real-art-design.md`

---

## File Structure

- `src/render/facing.ts` (new) — `facingFromDelta` pure helper
- `src/assets/manifest.ts` (rewrite) — directional schema + `MANIFEST` (+ `getCharacter`)
- `src/render/animations.ts` (rewrite) — per-character/state/facing anims
- `src/scenes/PreloadScene.ts` (rewrite) — load `manifest.sheets`
- `src/render/enemyView.ts` (rewrite) — facing + depth-sort + scale/origin
- `src/render/towerView.ts` (rewrite) — facing + depth-sort + scale/origin
- `src/render/fx.ts` (rewrite) — FX on a high depth layer
- `src/scenes/GameScene.ts` (edit) — depth scheme; pass target y to `playAttack`
- `tests/render/facing.test.ts` (new), `tests/assets/manifest.test.ts` (rewrite)
- `public/assets/sprites/lapulapu/` (new) + `CREDITS.md` (new) — the LPC spike

---

## Task 1: Facing helper

**Files:**
- Create: `src/render/facing.ts`
- Test: `tests/render/facing.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { facingFromDelta } from '../../src/render/facing';

describe('facingFromDelta', () => {
  it('faces down when idle', () => {
    expect(facingFromDelta(0, 0)).toEqual({ facing: 'down', flipX: false });
  });

  it('uses vertical facing when |dy| > |dx|', () => {
    expect(facingFromDelta(1, 5)).toEqual({ facing: 'down', flipX: false });
    expect(facingFromDelta(-1, -5)).toEqual({ facing: 'up', flipX: false });
  });

  it('uses side facing (flipped for left) when |dx| >= |dy|', () => {
    expect(facingFromDelta(5, 0)).toEqual({ facing: 'side', flipX: false });
    expect(facingFromDelta(-5, 1)).toEqual({ facing: 'side', flipX: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/render/facing.test.ts`
Expected: FAIL — cannot resolve `facing`.

- [ ] **Step 3: Write the implementation**

```ts
export type Facing = 'down' | 'up' | 'side';

export interface FacingResult {
  facing: Facing;
  flipX: boolean;
}

export function facingFromDelta(dx: number, dy: number): FacingResult {
  if (dx === 0 && dy === 0) return { facing: 'down', flipX: false };
  if (Math.abs(dy) > Math.abs(dx)) {
    return { facing: dy > 0 ? 'down' : 'up', flipX: false };
  }
  return { facing: 'side', flipX: dx < 0 };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/render/facing.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/render/facing.ts tests/render/facing.test.ts
git commit -m "feat: add facingFromDelta helper for 3/4 view"
```

---

## Task 2: Directional manifest + 3/4 rendering + depth-sort

A cohesive migration. It rewrites the manifest to a directional schema (placeholders re-expressed so behavior is preserved), updates every consumer, and applies the 3/4 depth scheme. The build is green again at the end.

**Files:**
- Rewrite: `src/assets/manifest.ts`, `src/render/animations.ts`, `src/scenes/PreloadScene.ts`, `src/render/enemyView.ts`, `src/render/towerView.ts`, `src/render/fx.ts`
- Edit: `src/scenes/GameScene.ts`
- Rewrite test: `tests/assets/manifest.test.ts`

- [ ] **Step 1: Rewrite `src/assets/manifest.ts`**

```ts
export type Facing = 'down' | 'up' | 'side';

export interface SpriteSheetDef {
  key: string;
  path: string;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
}

export interface DirClip {
  start: number;
  end: number;
}

export interface AnimClip {
  sheet: string; // references a SpriteSheetDef.key
  frameRate: number;
  repeat: number; // -1 loop, 0 once
  rows: Partial<Record<Facing, DirClip>>; // at least 'down'
}

export interface ImageAsset {
  key: string;
  path: string;
}

export interface SheetAsset {
  key: string;
  path: string;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
}

export interface CharacterAsset {
  key: string;
  displayScale: number;
  originY: number;
  anims: { idle: AnimClip; walk: AnimClip; attack: AnimClip; death: AnimClip };
}

export interface AssetManifest {
  sheets: SpriteSheetDef[];
  characters: CharacterAsset[];
  fx: { projectile: ImageAsset; hitPuff: SheetAsset };
  map: { ground: ImageAsset; pathTile: ImageAsset; buildMarker: ImageAsset };
}

const CHAR_KEYS = ['lapulapu', 'gabriela', 'aswang', 'tiktik'];

// Placeholder sheets are 32x32, 13 frames: idle 0-1 | walk 2-5 | attack 6-8 | death 9-12.
function placeholderChar(key: string): CharacterAsset {
  return {
    key,
    displayScale: 1,
    originY: 0.5,
    anims: {
      idle: { sheet: key, frameRate: 4, repeat: -1, rows: { down: { start: 0, end: 1 } } },
      walk: { sheet: key, frameRate: 8, repeat: -1, rows: { down: { start: 2, end: 5 } } },
      attack: { sheet: key, frameRate: 12, repeat: 0, rows: { down: { start: 6, end: 8 } } },
      death: { sheet: key, frameRate: 10, repeat: 0, rows: { down: { start: 9, end: 12 } } },
    },
  };
}

export const MANIFEST: AssetManifest = {
  sheets: CHAR_KEYS.map((key) => ({
    key,
    path: `assets/sprites/${key}.png`,
    frameWidth: 32,
    frameHeight: 32,
    frameCount: 13,
  })),
  characters: CHAR_KEYS.map(placeholderChar),
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

export function getCharacter(key: string): CharacterAsset | undefined {
  return MANIFEST.characters.find((c) => c.key === key);
}
```

- [ ] **Step 2: Rewrite `tests/assets/manifest.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { MANIFEST } from '../../src/assets/manifest';

const STATES = ['idle', 'walk', 'attack', 'death'] as const;

describe('asset manifest', () => {
  it('has the four expected characters with unique keys', () => {
    const keys = MANIFEST.characters.map((c) => c.key).sort();
    expect(keys).toEqual(['aswang', 'gabriela', 'lapulapu', 'tiktik']);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('defines idle/walk/attack/death with a down row, in bounds, scaled', () => {
    const sheetByKey = new Map(MANIFEST.sheets.map((s) => [s.key, s]));
    for (const c of MANIFEST.characters) {
      expect(c.displayScale).toBeGreaterThan(0);
      for (const state of STATES) {
        const clip = c.anims[state];
        const sheet = sheetByKey.get(clip.sheet);
        expect(sheet, `sheet ${clip.sheet} exists`).toBeDefined();
        expect(clip.rows.down, `${c.key}.${state} has a down row`).toBeDefined();
        expect(clip.frameRate).toBeGreaterThan(0);
        for (const dir of Object.keys(clip.rows) as Array<'down' | 'up' | 'side'>) {
          const r = clip.rows[dir]!;
          expect(r.start).toBeGreaterThanOrEqual(0);
          expect(r.end).toBeGreaterThanOrEqual(r.start);
          expect(r.end).toBeLessThan(sheet!.frameCount);
        }
      }
    }
  });

  it('points every asset path under assets/', () => {
    const paths = [
      ...MANIFEST.sheets.map((s) => s.path),
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

- [ ] **Step 3: Rewrite `src/render/animations.ts`**

```ts
import Phaser from 'phaser';
import { MANIFEST, type Facing } from '../assets/manifest';

const STATES = ['idle', 'walk', 'attack', 'death'] as const;
const FACINGS: Facing[] = ['down', 'up', 'side'];

export function registerAnimations(scene: Phaser.Scene): void {
  for (const c of MANIFEST.characters) {
    for (const state of STATES) {
      const clip = c.anims[state];
      for (const facing of FACINGS) {
        const row = clip.rows[facing];
        if (!row) continue;
        scene.anims.create({
          key: `${c.key}-${state}-${facing}`,
          frames: scene.anims.generateFrameNumbers(clip.sheet, { start: row.start, end: row.end }),
          frameRate: clip.frameRate,
          repeat: clip.repeat,
        });
      }
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

- [ ] **Step 4: Rewrite `src/scenes/PreloadScene.ts`**

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

    for (const s of MANIFEST.sheets) {
      this.load.spritesheet(s.key, s.path, { frameWidth: s.frameWidth, frameHeight: s.frameHeight });
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

- [ ] **Step 5: Rewrite `src/render/enemyView.ts`**

```ts
import Phaser from 'phaser';
import type { Enemy } from '../game/entities/enemy';
import { getCharacter } from '../assets/manifest';
import { facingFromDelta } from './facing';

export class EnemyView {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly key: string;
  private last: { x: number; y: number };

  constructor(scene: Phaser.Scene, enemy: Enemy) {
    this.key = enemy.type.id;
    const c = getCharacter(this.key);
    const baseSheet = c ? c.anims.walk.sheet : this.key;
    this.sprite = scene.add.sprite(enemy.pos.x, enemy.pos.y, baseSheet);
    if (c) this.sprite.setOrigin(0.5, c.originY).setScale(c.displayScale);
    this.sprite.setDepth(enemy.pos.y);
    this.play(`${this.key}-walk-down`);
    this.last = { x: enemy.pos.x, y: enemy.pos.y };
  }

  sync(enemy: Enemy): void {
    const dx = enemy.pos.x - this.last.x;
    const dy = enemy.pos.y - this.last.y;
    if (dx !== 0 || dy !== 0) {
      const { facing, flipX } = facingFromDelta(dx, dy);
      this.sprite.setFlipX(flipX);
      this.play(`${this.key}-walk-${facing}`);
    }
    this.last = { x: enemy.pos.x, y: enemy.pos.y };
    this.sprite.setPosition(enemy.pos.x, enemy.pos.y);
    this.sprite.setDepth(enemy.pos.y);
  }

  // Play an animation if it exists (falling back to the down variant), without restarting it.
  private play(animKey: string): void {
    const scene = this.sprite.scene;
    const key = scene.anims.exists(animKey) ? animKey : `${this.key}-walk-down`;
    if (this.sprite.anims.currentAnim?.key !== key) this.sprite.play(key, true);
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
```

- [ ] **Step 6: Rewrite `src/render/towerView.ts`**

```ts
import Phaser from 'phaser';
import type { Tower } from '../game/entities/tower';
import { getCharacter } from '../assets/manifest';
import { facingFromDelta } from './facing';

export class TowerView {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly key: string;

  constructor(scene: Phaser.Scene, tower: Tower) {
    this.key = tower.type.id;
    const c = getCharacter(this.key);
    const baseSheet = c ? c.anims.idle.sheet : this.key;
    this.sprite = scene.add.sprite(tower.pos.x, tower.pos.y, baseSheet);
    if (c) this.sprite.setOrigin(0.5, c.originY).setScale(c.displayScale);
    this.sprite.setDepth(tower.pos.y);
    this.play(`${this.key}-idle-down`);
  }

  playAttack(targetX: number, targetY: number): void {
    const { facing, flipX } = facingFromDelta(targetX - this.sprite.x, targetY - this.sprite.y);
    this.sprite.setFlipX(flipX);
    this.sprite.play(this.resolve(`${this.key}-attack-${facing}`, `${this.key}-attack-down`), true);
    this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.sprite.play(this.resolve(`${this.key}-idle-${facing}`, `${this.key}-idle-down`));
    });
  }

  private resolve(preferred: string, fallback: string): string {
    return this.sprite.scene.anims.exists(preferred) ? preferred : fallback;
  }

  private play(animKey: string): void {
    const key = this.sprite.scene.anims.exists(animKey) ? animKey : `${this.key}-idle-down`;
    this.sprite.play(key, true);
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
```

- [ ] **Step 7: Rewrite `src/render/fx.ts`** (FX live above y-sorted entities, below the HUD)

```ts
import Phaser from 'phaser';
import type { Vec2 } from '../game/geometry';
import { MANIFEST } from '../assets/manifest';

const FX_DEPTH = 5000;

export function spawnProjectile(scene: Phaser.Scene, from: Vec2, to: Vec2): void {
  const p = scene.add.image(from.x, from.y, MANIFEST.fx.projectile.key).setDepth(FX_DEPTH);
  scene.tweens.add({ targets: p, x: to.x, y: to.y, duration: 120, onComplete: () => p.destroy() });
}

export function spawnHitPuff(scene: Phaser.Scene, at: Vec2): void {
  const s = scene.add.sprite(at.x, at.y, MANIFEST.fx.hitPuff.key).setDepth(FX_DEPTH);
  s.play(MANIFEST.fx.hitPuff.key);
  s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => s.destroy());
}

export function spawnDeath(scene: Phaser.Scene, enemyTypeId: string, at: Vec2): void {
  const s = scene.add.sprite(at.x, at.y, enemyTypeId).setDepth(FX_DEPTH);
  s.play(deathAnimKey(scene, enemyTypeId));
  s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => s.destroy());
}

function deathAnimKey(scene: Phaser.Scene, enemyTypeId: string): string {
  const down = `${enemyTypeId}-death-down`;
  return scene.anims.exists(down) ? down : `${enemyTypeId}-walk-down`;
}
```

- [ ] **Step 8: Edit `src/scenes/GameScene.ts`** — three changes for the depth scheme and the attack target.

(a) The HP-bar graphics depth — change `this.add.graphics().setDepth(9)` to:

```ts
    this.hpBars = this.add.graphics().setDepth(9000);
```

(b) The HUD + overlay depths — change both `.setDepth(20)` calls to `.setDepth(10000)` (hud text and overlay text).

(c) In `consumeEvents()`, pass the target's y to `playAttack`:

```ts
        if (view.sprite.x === shot.from.x && view.sprite.y === shot.from.y) {
          view.playAttack(shot.to.x, shot.to.y);
        }
```

- [ ] **Step 9: Type-check, test, build**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: no type errors; all tests pass (38 total: previous 35 + 3 new facing tests; the manifest rewrite keeps its 3); build writes `dist/` cleanly.

- [ ] **Step 10: Commit**

```bash
git add src/assets/manifest.ts src/render/animations.ts src/scenes/PreloadScene.ts src/render/enemyView.ts src/render/towerView.ts src/render/fx.ts src/scenes/GameScene.ts tests/assets/manifest.test.ts
git commit -m "feat: directional manifest + 3/4 depth-sorted rendering"
```

---

## Task 3: LPC character spike (Lapu-Lapu)

Replace the Lapu-Lapu placeholder with a real **LPC universal-layout** sheet. The universal LPC sheet is 64×64 frames, 13 columns × 21 rows (832×1344), so the frame indices below are fixed by that layout. The only variable is *which* CC-BY-SA character art you fetch.

**LPC universal row layout** (each action spans 4 rows: up, left, down, right; frame index = `row * 13 + col`):
- Walk: rows 8–11, 9 frames (cols 0–8) → down=row 10 (130–138), up=row 8 (104–112), right=row 11 (143–151)
- Slash (attack): rows 12–15, 6 frames (cols 0–5) → down=row 14 (182–187), up=row 12 (156–161), right=row 15 (195–200)
- Hurt (death): row 20, 6 frames (cols 0–5) → 260–265 (single direction)
- Idle: reuse walk-down frame 130 as a 1-frame loop

**Files:**
- Add: `public/assets/sprites/lapulapu/sheet.png` (downloaded), `CREDITS.md`
- Edit: `src/assets/manifest.ts` (the lapulapu sheet def + character entry)

- [ ] **Step 1: Source a CC-BY-SA LPC universal-layout character sheet**

Find a single-image **LPC "universal" spritesheet** (64×64 frames, 832×1344, includes walk/slash/hurt) with a **direct download URL** and a CC-BY-SA / GPL license. Search OpenGameArt for "LPC" character submissions (e.g., the base/reference universal sheets); confirm the license and the author. Note the author, license, and source URL for `CREDITS.md`.

If you cannot find a directly-downloadable universal-layout sheet, STOP and report BLOCKED with the candidates you found (URL + license + why unusable) so a sheet can be provided manually. Do not invent a URL.

- [ ] **Step 2: Download it**

```bash
mkdir -p public/assets/sprites/lapulapu
curl -L -o public/assets/sprites/lapulapu/sheet.png "<DIRECT_URL_FROM_STEP_1>"
```

Verify the image is 832×1344 (64px grid):

```bash
node -e "const {PNG}=require('pngjs');const fs=require('fs');const p=PNG.sync.read(fs.readFileSync('public/assets/sprites/lapulapu/sheet.png'));console.log(p.width,p.height)"
```
Expected: `832 1344`. If the dimensions differ, the sheet isn't standard universal layout — report BLOCKED with the actual dimensions.

- [ ] **Step 3: Create `CREDITS.md`**

```markdown
# Credits

Art assets used in Bayani TD.

## Characters
- **Lapu-Lapu sprite** — LPC universal spritesheet.
  - Author(s): <AUTHORS_FROM_STEP_1>
  - License: CC-BY-SA 3.0 / GPL 3.0
  - Source: <URL_FROM_STEP_1>
```

- [ ] **Step 4: Point Lapu-Lapu at the real sheet in `src/assets/manifest.ts`**

Replace the lapulapu entry in `sheets` (the 32×32 placeholder line) with the 64×64 universal sheet:

```ts
  // in MANIFEST.sheets — replace the generated lapulapu line with:
  { key: 'lapulapu', path: 'assets/sprites/lapulapu/sheet.png', frameWidth: 64, frameHeight: 64, frameCount: 273 },
```

Because `sheets` is built with `CHAR_KEYS.map(...)`, change it to keep the other three generated and override lapulapu:

```ts
  sheets: [
    { key: 'lapulapu', path: 'assets/sprites/lapulapu/sheet.png', frameWidth: 64, frameHeight: 64, frameCount: 273 },
    ...['gabriela', 'aswang', 'tiktik'].map((key) => ({
      key,
      path: `assets/sprites/${key}.png`,
      frameWidth: 32,
      frameHeight: 32,
      frameCount: 13,
    })),
  ],
```

And replace the lapulapu character (it currently comes from `placeholderChar`) with an explicit LPC entry. Change the `characters` array to:

```ts
  characters: [
    {
      key: 'lapulapu',
      displayScale: 0.6,
      originY: 0.85,
      anims: {
        idle: { sheet: 'lapulapu', frameRate: 4, repeat: -1, rows: { down: { start: 130, end: 130 } } },
        walk: {
          sheet: 'lapulapu',
          frameRate: 9,
          repeat: -1,
          rows: { down: { start: 130, end: 138 }, up: { start: 104, end: 112 }, side: { start: 143, end: 151 } },
        },
        attack: {
          sheet: 'lapulapu',
          frameRate: 12,
          repeat: 0,
          rows: { down: { start: 182, end: 187 }, up: { start: 156, end: 161 }, side: { start: 195, end: 200 } },
        },
        death: { sheet: 'lapulapu', frameRate: 10, repeat: 0, rows: { down: { start: 260, end: 265 } } },
      },
    },
    ...['gabriela', 'aswang', 'tiktik'].map(placeholderChar),
  ],
```

- [ ] **Step 5: Type-check, test, build**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: no type errors; all 38 tests pass (manifest validation now checks the LPC indices against `frameCount: 273`); build clean.

- [ ] **Step 6: Manual verification**

Run `npm run dev`. With the **Chrome window foreground** (per the verification gotchas — the loop freezes when occluded), place a Lapu-Lapu tower and start a wave. Confirm Lapu-Lapu renders as a real animated character, faces its target when firing, and is depth-sorted (enemies passing in front/behind overlap correctly). The other three remain placeholder squares.

- [ ] **Step 7: Commit**

```bash
git add public/assets/sprites/lapulapu/sheet.png CREDITS.md src/assets/manifest.ts
git commit -m "feat: integrate real LPC sprite for Lapu-Lapu (spike)"
```

---

## Definition of Done

- `npm test` passes (38 tests); `npm run build` clean.
- The game renders in 3/4 with directional facing + depth-sort; placeholders still work for unsourced characters.
- Lapu-Lapu is a real animated LPC sprite, credited in `CREDITS.md`.

## Follow-up (not in this plan)

Rolling out real art for **gabriela, aswang, tiktik** repeats Task 3 per character (source → download → manifest entry → credit → verify). It's deferred because the exact assets/URLs are discovered during the spike; once Task 3 proves the path, each remaining character is the same procedure. ChatGPT title/portraits are **Slice B** (separate spec).
