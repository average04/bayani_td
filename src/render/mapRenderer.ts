import Phaser from 'phaser';
import type { LevelConfig } from '../game/config/levels';
import { MANIFEST } from '../assets/manifest';
import { gridCols, gridRows } from '../game/grid';

// Draws the ground, a tiled path strip along the waypoints, and a subtle placement grid.
export function renderMap(scene: Phaser.Scene, level: LevelConfig): void {
  const width = level.cols * level.tileSize;
  const height = level.rows * level.tileSize;

  scene.add.tileSprite(0, 0, width, height, MANIFEST.map.ground.key).setOrigin(0, 0).setDepth(-20);

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

  // subtle placement grid
  const grid = scene.add.graphics().setDepth(-12);
  grid.lineStyle(1, 0x000000, 0.08);
  const cs = level.cellSize;
  for (let c = 0; c <= gridCols(level); c++) grid.lineBetween(c * cs, 0, c * cs, height);
  for (let r = 0; r <= gridRows(level); r++) grid.lineBetween(0, r * cs, width, r * cs);
}
