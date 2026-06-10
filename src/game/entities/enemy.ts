import type { EnemyType } from '../config/enemies';
import type { Vec2 } from '../geometry';

export class Enemy {
  readonly type: EnemyType;
  readonly maxHp: number; // effective max HP (base scaled by wave); used for the health bar & regen cap
  hp: number;
  pos: Vec2;
  pathIndex: number;
  reachedEnd: boolean;
  slowFactor = 1;
  slowTimer = 0;
  poisonDps = 0;
  poisonTimer = 0;
  private readonly path: Vec2[];

  constructor(type: EnemyType, path: Vec2[], maxHp: number = type.maxHp) {
    this.type = type;
    this.maxHp = maxHp;
    this.hp = maxHp;
    this.path = path;
    this.pos = { x: path[0].x, y: path[0].y };
    this.pathIndex = 1;
    this.reachedEnd = path.length < 2;
  }

  update(dt: number): void {
    // poison: true damage, ignores armor
    if (this.poisonTimer > 0) {
      this.hp -= this.poisonDps * dt;
      this.poisonTimer -= dt;
      if (this.poisonTimer <= 0) this.poisonDps = 0;
    }
    // regen
    const regen = this.type.regenPerSec ?? 0;
    if (regen > 0 && this.hp > 0 && !this.reachedEnd) {
      this.hp = Math.min(this.maxHp, this.hp + regen * dt);
    }

    if (this.reachedEnd) return;

    // movement at the effective (possibly slowed) speed
    let speedMult = 1;
    if (this.slowTimer > 0) {
      speedMult = this.slowFactor;
      this.slowTimer = Math.max(0, this.slowTimer - dt);
      if (this.slowTimer <= 0) this.slowFactor = 1;
    }
    let travel = this.type.speed * speedMult * dt;
    while (travel > 0 && this.pathIndex < this.path.length) {
      const target = this.path[this.pathIndex];
      const dx = target.x - this.pos.x;
      const dy = target.y - this.pos.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= travel) {
        this.pos = { x: target.x, y: target.y };
        this.pathIndex++;
        travel -= dist;
      } else {
        this.pos = { x: this.pos.x + (dx / dist) * travel, y: this.pos.y + (dy / dist) * travel };
        travel = 0;
      }
    }
    if (this.pathIndex >= this.path.length) {
      this.reachedEnd = true;
    }
  }

  takeDamage(amount: number): void {
    // A hit always lands at least 1 damage — armor can blunt a shot but never fully negate it.
    this.hp -= Math.max(1, amount - (this.type.armor ?? 0));
  }

  applySlow(factor: number, duration: number): void {
    this.slowFactor = Math.min(this.slowFactor, factor);
    this.slowTimer = Math.max(this.slowTimer, duration);
  }

  applyPoison(dps: number, duration: number): void {
    this.poisonDps = Math.max(this.poisonDps, dps);
    this.poisonTimer = Math.max(this.poisonTimer, duration);
  }

  get isDead(): boolean {
    return this.hp <= 0;
  }

  /** The waypoint this enemy is currently walking toward, or null if it finished. */
  get nextWaypoint(): Vec2 | null {
    return this.pathIndex < this.path.length ? this.path[this.pathIndex] : null;
  }
}
