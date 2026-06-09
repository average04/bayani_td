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

// Placeholder sheets are 32x32, 13 frames: idle 0-1 | walk 2-5 | attack 6-8 | death 9-12.
// Exported so it remains available for future unsourced characters.
export function placeholderChar(key: string): CharacterAsset {
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
  sheets: [
    { key: 'lapulapu', path: 'assets/sprites/lapulapu/sheet.png', frameWidth: 64, frameHeight: 64, frameCount: 273 },
    { key: 'gabriela', path: 'assets/sprites/gabriela/sheet.png', frameWidth: 64, frameHeight: 64, frameCount: 273 },
    // aswang: ghost sprite (bluecarrot16 / LPC Monsters, CC-BY-SA 3.0 / GPL 3.0)
    // 384x256 → 64×64 frames, 6 cols × 4 rows = 24 frames; rows = down/up/left/right float cycle
    { key: 'aswang', path: 'assets/sprites/aswang/sheet.png', frameWidth: 64, frameHeight: 64, frameCount: 24 },
    // tiktik: bat sprite (bagzie / bluecarrot16 / LPC Monsters, CC-BY-SA 3.0 / GPL 3.0)
    // 448x256 → 64×64 frames, 7 cols × 4 rows = 28 frames; rows = down/up/left/right fly cycle
    { key: 'tiktik', path: 'assets/sprites/tiktik/sheet.png', frameWidth: 64, frameHeight: 64, frameCount: 28 },
  ],
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
    {
      key: 'gabriela',
      displayScale: 0.6,
      originY: 0.85,
      anims: {
        idle: { sheet: 'gabriela', frameRate: 4, repeat: -1, rows: { down: { start: 130, end: 130 } } },
        walk: {
          sheet: 'gabriela',
          frameRate: 9,
          repeat: -1,
          rows: { down: { start: 130, end: 138 }, up: { start: 104, end: 112 }, side: { start: 143, end: 151 } },
        },
        attack: {
          sheet: 'gabriela',
          frameRate: 12,
          repeat: 0,
          rows: { down: { start: 182, end: 187 }, up: { start: 156, end: 161 }, side: { start: 195, end: 200 } },
        },
        death: { sheet: 'gabriela', frameRate: 10, repeat: 0, rows: { down: { start: 260, end: 265 } } },
      },
    },
    {
      key: 'aswang',
      displayScale: 0.55,
      originY: 0.85,
      anims: {
        // 6 cols × 4 rows = 24 frames; row 0 = down (0-5), row 1 = up (6-11), row 2 = side (12-17), row 3 = right (18-23)
        idle: { sheet: 'aswang', frameRate: 4, repeat: -1, rows: { down: { start: 0, end: 0 } } },
        walk: {
          sheet: 'aswang',
          frameRate: 6,
          repeat: -1,
          rows: { down: { start: 0, end: 5 }, up: { start: 6, end: 11 }, side: { start: 12, end: 17 } },
        },
        attack: {
          sheet: 'aswang',
          frameRate: 8,
          repeat: 0,
          rows: { down: { start: 0, end: 5 }, up: { start: 6, end: 11 }, side: { start: 12, end: 17 } },
        },
        death: { sheet: 'aswang', frameRate: 6, repeat: 0, rows: { down: { start: 21, end: 23 } } },
      },
    },
    {
      key: 'tiktik',
      displayScale: 0.5,
      originY: 0.85,
      anims: {
        // 7 cols × 4 rows = 28 frames; row 0 = down (0-6), row 1 = up (7-13), row 2 = side (14-20), row 3 = right (21-27)
        idle: { sheet: 'tiktik', frameRate: 4, repeat: -1, rows: { down: { start: 0, end: 0 } } },
        walk: {
          sheet: 'tiktik',
          frameRate: 8,
          repeat: -1,
          rows: { down: { start: 0, end: 6 }, up: { start: 7, end: 13 }, side: { start: 14, end: 20 } },
        },
        attack: {
          sheet: 'tiktik',
          frameRate: 10,
          repeat: 0,
          rows: { down: { start: 0, end: 6 }, up: { start: 7, end: 13 }, side: { start: 14, end: 20 } },
        },
        death: { sheet: 'tiktik', frameRate: 6, repeat: 0, rows: { down: { start: 25, end: 27 } } },
      },
    },
  ],
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
