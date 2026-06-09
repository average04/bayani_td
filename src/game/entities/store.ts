import type { Vec2 } from '../geometry';
import { STORE, baseStoreIncome, effectiveStoreIncome, type StoreIncome } from '../config/store';

export class Store {
  readonly pos: Vec2; // footprint center pixel
  readonly col: number; // top-left footprint cell
  readonly row: number;
  levels: [number, number] = [0, 0]; // [tick path, passive path]
  income: StoreIncome;
  tickTimer = 0;
  passiveTimer = 0;
  spent: number;

  constructor(pos: Vec2, col: number, row: number) {
    this.pos = pos;
    this.col = col;
    this.row = row;
    this.income = baseStoreIncome();
    this.spent = STORE.cost;
  }

  upgrade(path: number): void {
    this.levels[path] += 1;
    this.income = effectiveStoreIncome(this.levels);
  }

  // Advance the income timers by dt; return the gold to grant this frame
  // (a tick payout when its timer elapses, plus the per-second passive drip).
  tick(dt: number): number {
    let gold = 0;
    this.tickTimer += dt;
    if (this.tickTimer >= this.income.tickInterval) {
      this.tickTimer -= this.income.tickInterval;
      gold += this.income.tickAmount;
    }
    if (this.income.passivePerSec > 0) {
      this.passiveTimer += dt;
      if (this.passiveTimer >= 1) {
        this.passiveTimer -= 1;
        gold += this.income.passivePerSec;
      }
    }
    return gold;
  }
}
