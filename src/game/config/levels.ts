import type { Vec2 } from '../geometry';

export interface LevelConfig {
  id: string;
  name: string;
  tileSize: number;
  cols: number;
  rows: number;
  cellSize: number;
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
  cellSize: 24,
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
