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
