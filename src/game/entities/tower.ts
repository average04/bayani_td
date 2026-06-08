import type { HeroType } from '../config/heroes';
import { distance, type Vec2 } from '../geometry';

export class Tower {
  readonly type: HeroType;
  readonly pos: Vec2;
  cooldown: number; // seconds remaining until it can fire

  constructor(type: HeroType, pos: Vec2) {
    this.type = type;
    this.pos = pos;
    this.cooldown = 0;
  }

  update(dt: number): void {
    this.cooldown = Math.max(0, this.cooldown - dt);
  }

  get canFire(): boolean {
    return this.cooldown <= 0;
  }

  resetCooldown(): void {
    this.cooldown = 1 / this.type.fireRate;
  }

  inRange(target: Vec2): boolean {
    return distance(this.pos, target) <= this.type.range;
  }
}
