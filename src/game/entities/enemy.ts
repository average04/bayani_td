import type { EnemyType } from '../config/enemies';
import type { Vec2 } from '../geometry';

export class Enemy {
  readonly type: EnemyType;
  hp: number;
  pos: Vec2;
  pathIndex: number; // index of the next waypoint to walk toward
  reachedEnd: boolean;
  private readonly path: Vec2[];

  constructor(type: EnemyType, path: Vec2[]) {
    this.type = type;
    this.hp = type.maxHp;
    this.path = path;
    this.pos = { x: path[0].x, y: path[0].y };
    this.pathIndex = 1;
    this.reachedEnd = path.length < 2;
  }

  update(dt: number): void {
    if (this.reachedEnd) return;
    let travel = this.type.speed * dt;
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
    this.hp -= amount;
  }

  get isDead(): boolean {
    return this.hp <= 0;
  }

  /** The waypoint this enemy is currently walking toward, or null if it finished. */
  get nextWaypoint(): Vec2 | null {
    return this.pathIndex < this.path.length ? this.path[this.pathIndex] : null;
  }
}
