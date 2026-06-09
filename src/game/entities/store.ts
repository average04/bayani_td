import type { Vec2 } from '../geometry';
import { STORE } from '../config/store';

export class Store {
  readonly pos: Vec2; // footprint center pixel
  readonly col: number; // top-left footprint cell
  readonly row: number;
  timer = 0;
  spent: number;

  constructor(pos: Vec2, col: number, row: number) {
    this.pos = pos;
    this.col = col;
    this.row = row;
    this.spent = STORE.cost;
  }

  // Advance the income timer by dt; return the gold to grant this tick (0 or incomeAmount).
  tick(dt: number): number {
    this.timer += dt;
    if (this.timer >= STORE.incomeInterval) {
      this.timer -= STORE.incomeInterval;
      return STORE.incomeAmount;
    }
    return 0;
  }
}
