import { describe, it, expect } from 'vitest';
import {
  gridCols,
  gridRows,
  pixelToCell,
  cellCenter,
  footprintCenter,
  footprintCells,
  footprintTopLeftAt,
  pathCells,
  canPlace,
  cellKey,
} from '../../src/game/grid';
import type { LevelConfig } from '../../src/game/config/levels';

const level: LevelConfig = {
  id: 't',
  name: 'T',
  tileSize: 48,
  cols: 16,
  rows: 10,
  cellSize: 24,
  path: [
    { x: 0, y: 120 },
    { x: 768, y: 120 },
  ],
  startingGold: 100,
  startingLives: 20,
};

describe('grid', () => {
  it('derives grid dimensions from the level', () => {
    expect(gridCols(level)).toBe(32);
    expect(gridRows(level)).toBe(20);
  });

  it('converts pixels to cells and computes centers', () => {
    expect(pixelToCell(level, 50, 28)).toEqual({ col: 2, row: 1 });
    expect(cellCenter(level, 0, 0)).toEqual({ x: 12, y: 12 });
    expect(footprintCenter(level, 0, 0)).toEqual({ x: 24, y: 24 });
  });

  it('lists the four cells of a 2x2 footprint', () => {
    expect(footprintCells(3, 4)).toEqual([
      { col: 3, row: 4 },
      { col: 4, row: 4 },
      { col: 3, row: 5 },
      { col: 4, row: 5 },
    ]);
  });

  it('centers a 2x2 footprint near a pointer, clamped to bounds', () => {
    expect(footprintTopLeftAt(level, 100, 100)).toEqual({ col: 3, row: 3 });
    expect(footprintTopLeftAt(level, -50, -50)).toEqual({ col: 0, row: 0 });
    expect(footprintTopLeftAt(level, 9999, 9999)).toEqual({ col: 30, row: 18 });
  });

  it('marks cells along the path line as blocked', () => {
    const blocked = pathCells(level);
    expect(blocked.has(cellKey(10, 5))).toBe(true); // path at y=120 -> row 5
    expect(blocked.has(cellKey(10, 0))).toBe(false); // far from the path
  });

  it('canPlace respects bounds, path, and occupancy', () => {
    const blocked = pathCells(level);
    const occupied = new Set<string>();
    expect(canPlace(level, blocked, occupied, 4, 0)).toBe(true); // off-path
    expect(canPlace(level, blocked, occupied, 4, 4)).toBe(false); // footprint hits path row 5
    expect(canPlace(level, blocked, occupied, 31, 0)).toBe(false); // col+1 out of bounds
    occupied.add(cellKey(6, 0));
    expect(canPlace(level, blocked, occupied, 6, 0)).toBe(false); // occupied
  });
});
