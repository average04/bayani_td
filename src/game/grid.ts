import { distance, type Vec2 } from './geometry';
import type { LevelConfig } from './config/levels';

export interface Cell {
  col: number;
  row: number;
}

// A cell whose center is within this many px of the path line is "blocked" (you can't build on it).
const PATH_BLOCK_RADIUS = 18;

export function gridCols(level: LevelConfig): number {
  return (level.cols * level.tileSize) / level.cellSize;
}

export function gridRows(level: LevelConfig): number {
  return (level.rows * level.tileSize) / level.cellSize;
}

export function pixelToCell(level: LevelConfig, x: number, y: number): Cell {
  return { col: Math.floor(x / level.cellSize), row: Math.floor(y / level.cellSize) };
}

export function cellCenter(level: LevelConfig, col: number, row: number): Vec2 {
  return { x: col * level.cellSize + level.cellSize / 2, y: row * level.cellSize + level.cellSize / 2 };
}

// Center pixel of a w x h footprint whose top-left cell is (col,row). Defaults to 2x2.
export function footprintCenter(level: LevelConfig, col: number, row: number, w = 2, h = 2): Vec2 {
  return { x: (col + w / 2) * level.cellSize, y: (row + h / 2) * level.cellSize };
}

export function footprintCells(col: number, row: number, w = 2, h = 2): Cell[] {
  const cells: Cell[] = [];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) cells.push({ col: col + i, row: row + j });
  return cells;
}

export function cellKey(col: number, row: number): string {
  return `${col},${row}`;
}

// The w x h footprint top-left cell whose center sits nearest pixel (x,y), clamped on-board.
export function footprintTopLeftAt(level: LevelConfig, x: number, y: number, w = 2, h = 2): Cell {
  const cs = level.cellSize;
  const col = Math.round(x / cs - w / 2);
  const row = Math.round(y / cs - h / 2);
  return {
    col: Math.max(0, Math.min(gridCols(level) - w, col)),
    row: Math.max(0, Math.min(gridRows(level) - h, row)),
  };
}

function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return distance(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return distance(p, { x: a.x + t * dx, y: a.y + t * dy });
}

// Set of "col,row" keys for cells the path runs through.
export function pathCells(level: LevelConfig): Set<string> {
  const blocked = new Set<string>();
  const cols = gridCols(level);
  const rows = gridRows(level);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const c = cellCenter(level, col, row);
      for (let i = 1; i < level.path.length; i++) {
        if (distToSegment(c, level.path[i - 1], level.path[i]) <= PATH_BLOCK_RADIUS) {
          blocked.add(cellKey(col, row));
          break;
        }
      }
    }
  }
  return blocked;
}

// Can a w x h footprint with top-left (col,row) be placed?
export function canPlace(
  level: LevelConfig,
  blocked: Set<string>,
  occupied: Set<string>,
  col: number,
  row: number,
  w = 2,
  h = 2,
): boolean {
  const cols = gridCols(level);
  const rows = gridRows(level);
  for (const cell of footprintCells(col, row, w, h)) {
    if (cell.col < 0 || cell.row < 0 || cell.col >= cols || cell.row >= rows) return false;
    const k = cellKey(cell.col, cell.row);
    if (blocked.has(k) || occupied.has(k)) return false;
  }
  return true;
}
