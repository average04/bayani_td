import Phaser from 'phaser';
import type { Store } from '../game/entities/store';
import { STORE } from '../game/config/store';

// A simple procedural sari-sari store drawn with graphics (no texture/preload needed).
// Footprint is STORE.width x STORE.height cells, centered on store.pos.
export class StoreView {
  private readonly g: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, store: Store) {
    this.g = scene.add.graphics().setDepth(store.pos.y);
    this.draw(store.pos.x, store.pos.y);
  }

  private draw(cx: number, cy: number): void {
    const cs = 24;
    const w = STORE.width * cs; // 96
    const h = STORE.height * cs; // 48
    const x = cx - w / 2;
    const y = cy - h / 2;
    const g = this.g;

    // wall
    g.fillStyle(0xe9d6a3, 1);
    g.fillRect(x + 3, y + 13, w - 6, h - 13);
    // wooden posts
    g.fillStyle(0x6e4b2a, 1);
    g.fillRect(x + 2, y + 13, 4, h - 13);
    g.fillRect(x + w - 6, y + 13, 4, h - 13);
    // roof
    g.fillStyle(0xa83f2c, 1);
    g.fillRect(x, y + 4, w, 11);
    g.fillStyle(0xc4543c, 1);
    g.fillRect(x, y + 4, w, 3);
    // counter opening (dark)
    g.fillStyle(0x33241499, 1);
    g.fillRect(x + 9, y + 24, w - 18, h - 30);
    // striped awning under the roof
    for (let i = 0; i + 7 < w - 8; i += 7) {
      g.fillStyle(((i / 7) | 0) % 2 === 0 ? 0xd23b3b : 0xf3f0e6, 1);
      g.fillRect(x + 5 + i, y + 16, 7, 5);
    }
    // hanging sachets / goods (colorful)
    const goods = [0xff5a5a, 0xffd45a, 0x5ad0ff, 0x8aff7a, 0xff8af0, 0xffffff];
    for (let i = 0; i < 11; i++) {
      g.fillStyle(goods[i % goods.length], 1);
      g.fillRect(x + 11 + i * 6.5, y + 25, 4, 5);
    }
    // a couple of bottles on the counter
    g.fillStyle(0x2f9e6b, 1);
    g.fillRect(x + 14, y + 33, 3, 7);
    g.fillStyle(0xcf7d33, 1);
    g.fillRect(x + w - 18, y + 33, 3, 7);
  }

  destroy(): void {
    this.g.destroy();
  }
}
