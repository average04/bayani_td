import Phaser from 'phaser';
import type { Store } from '../game/entities/store';
import { MANIFEST } from '../assets/manifest';

// Renders the Sari-Sari Store art. The 96x72 sprite is anchored at the bottom of
// the 4x2 footprint so its roof/sign rise above; it sorts by its footprint y.
export class StoreView {
  private readonly sprite: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, store: Store) {
    this.sprite = scene.add
      .image(store.pos.x, store.pos.y + 28, MANIFEST.map.store.key)
      .setOrigin(0.5, 1)
      .setDepth(store.pos.y);
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
