import type { HeroType } from '../config/heroes';
import { baseStats, effectiveStats, type TowerStats } from '../config/upgrades';
import { distance, type Vec2 } from '../geometry';

export class Tower {
  readonly type: HeroType;
  readonly pos: Vec2;
  cooldown: number; // seconds remaining until it can fire
  levels: [number, number] = [0, 0];
  stats: TowerStats;

  constructor(type: HeroType, pos: Vec2) {
    this.type = type;
    this.pos = pos;
    this.cooldown = 0;
    this.stats = baseStats(type);
  }

  upgrade(path: number): void {
    this.levels[path] += 1;
    this.stats = effectiveStats(this.type, this.levels);
  }

  update(dt: number): void {
    this.cooldown = Math.max(0, this.cooldown - dt);
  }

  get canFire(): boolean {
    return this.cooldown <= 0;
  }

  resetCooldown(): void {
    this.cooldown = 1 / this.stats.fireRate;
  }

  inRange(target: Vec2): boolean {
    return distance(this.pos, target) <= this.stats.range;
  }
}
