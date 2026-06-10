import type { HeroType } from '../config/heroes';
import { baseStats, effectiveStats, type TowerStats } from '../config/upgrades';
import { distance, type Vec2 } from '../geometry';

export type TargetMode = 'first' | 'last' | 'strong' | 'close';
export const TARGET_MODES: TargetMode[] = ['first', 'last', 'strong', 'close'];

export class Tower {
  readonly type: HeroType;
  readonly pos: Vec2;
  cooldown: number; // seconds remaining until it can fire
  levels: [number, number] = [0, 0];
  stats: TowerStats;
  spent: number; // total gold invested (placement + upgrades), for sell refunds
  targetMode: TargetMode = 'first';
  shotCount = 0; // lifetime shots fired; drives every-Nth-shot traits (Rampage/Deadeye/Aftershock)

  constructor(type: HeroType, pos: Vec2) {
    this.type = type;
    this.pos = pos;
    this.cooldown = 0;
    this.stats = baseStats(type);
    this.spent = type.cost;
  }

  upgrade(path: number): void {
    this.levels[path] += 1;
    this.stats = effectiveStats(this.type, this.levels);
  }

  cycleTarget(): void {
    const i = TARGET_MODES.indexOf(this.targetMode);
    this.targetMode = TARGET_MODES[(i + 1) % TARGET_MODES.length];
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

  /** Count a fired shot; returns the 1-based shot number. */
  registerShot(): number {
    return ++this.shotCount;
  }

  inRange(target: Vec2): boolean {
    return distance(this.pos, target) <= this.stats.range;
  }
}
