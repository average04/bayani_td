import Phaser from 'phaser';
import type { LevelConfig } from '../game/config/levels';
import { MANIFEST } from '../assets/manifest';
import { gridCols, gridRows, pathCells, cellCenter, cellKey } from '../game/grid';

function drawBush(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  g.fillStyle(0x2f5a2f, 1);
  g.fillCircle(x - 4, y, 5);
  g.fillCircle(x + 4, y, 5);
  g.fillCircle(x, y - 3, 6);
  g.fillStyle(0x3f7040, 1);
  g.fillCircle(x - 2, y - 4, 3);
}

function drawRock(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  g.fillStyle(0x6b6b6b, 1);
  g.fillEllipse(x, y, 14, 10);
  g.fillStyle(0x8a8a8a, 1);
  g.fillEllipse(x - 1, y - 1, 8, 5);
}

// Draws the ground, a tiled path strip along the waypoints, scattered scenery, and a subtle
// grid. `offsetX` shifts the whole board right — used to render the rival's board beside ours.
export function renderMap(scene: Phaser.Scene, level: LevelConfig, offsetX = 0): void {
  const width = level.cols * level.tileSize;
  const height = level.rows * level.tileSize;

  scene.add.tileSprite(offsetX, 0, width, height, MANIFEST.map.ground.key).setOrigin(0, 0).setDepth(-20);

  // Lay the path twice along the waypoints: a darker, larger "edge" pass under a
  // dirt pass, so overlapping blobs read as one continuous path with a soft border.
  const key = MANIFEST.map.pathTile.key;
  const step = level.tileSize / 3;
  for (let i = 1; i < level.path.length; i++) {
    const a = level.path[i - 1];
    const b = level.path[i];
    const segLen = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
    const count = Math.max(1, Math.ceil(segLen / step));
    for (let s = 0; s <= count; s++) {
      const t = s / count;
      const x = offsetX + Phaser.Math.Linear(a.x, b.x, t);
      const y = Phaser.Math.Linear(a.y, b.y, t);
      scene.add.image(x, y, key).setScale(1.3).setTint(0x4a3420).setDepth(-16);
      scene.add.image(x, y, key).setDepth(-15);
    }
  }

  // scattered scenery (deterministic) on off-path cells — purely cosmetic, towers render over it
  const blocked = pathCells(level);
  const cols = gridCols(level);
  const rows = gridRows(level);
  let seed = 1337;
  const rnd = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };
  const decor = scene.add.graphics().setDepth(-11);
  for (let placed = 0, tries = 0; placed < 16 && tries < 300; tries++) {
    const col = 1 + Math.floor(rnd() * (cols - 2));
    const row = 1 + Math.floor(rnd() * (rows - 2));
    if (blocked.has(cellKey(col, row))) continue;
    const c = cellCenter(level, col, row);
    if (rnd() < 0.6) drawBush(decor, offsetX + c.x, c.y);
    else drawRock(decor, offsetX + c.x, c.y);
    placed++;
  }

  // subtle placement grid
  const grid = scene.add.graphics().setDepth(-12);
  grid.lineStyle(1, 0x000000, 0.08);
  const cs = level.cellSize;
  for (let c = 0; c <= gridCols(level); c++) grid.lineBetween(offsetX + c * cs, 0, offsetX + c * cs, height);
  for (let r = 0; r <= gridRows(level); r++) grid.lineBetween(offsetX, r * cs, offsetX + width, r * cs);
}
