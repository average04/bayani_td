import type { EnemyType } from '../config/enemies';
import type { Vec2 } from '../geometry';

export class Enemy {
  private static nextSeq = 1;
  readonly seq = Enemy.nextSeq++; // stable id for view-layer matching (e.g. rival board snapshots)
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
  rootTimer = 0; // while > 0 the enemy is rooted in place (speed 0), overriding any slow
  ampMult = 1; // damage-taken multiplier while marked (Fey Mark)
  ampTimer = 0;
  // carried so the world can spread this enemy's poison when it dies (Contagion)
  contagion: { radius: number; maxTargets: number; minDuration: number } | null = null;
  sent = false; // arrived via an opponent's send (multiplayer) — gets a visual marker
  slowResist: number; // 0..1: fraction of incoming slow shrugged off (baseline + deep-wave ramp)
  private readonly path: Vec2[];

  constructor(type: EnemyType, path: Vec2[], maxHp: number = type.maxHp) {
    this.type = type;
    this.slowResist = type.slowResist ?? 0; // the world raises this with the deep-wave ramp
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
    // fey mark wears off
    if (this.ampTimer > 0) {
      this.ampTimer = Math.max(0, this.ampTimer - dt);
      if (this.ampTimer <= 0) this.ampMult = 1;
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
    if (this.rootTimer > 0) {
      this.rootTimer = Math.max(0, this.rootTimer - dt);
      speedMult = 0; // roots fully immobilize, overriding any slow
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

  takeDamage(amount: number, pierce = false): void {
    const amped = this.ampTimer > 0 ? amount * this.ampMult : amount;
    const armor = pierce ? 0 : (this.type.armor ?? 0);
    // A hit always lands at least 1 damage — armor can blunt a shot but never fully negate it.
    this.hp -= Math.max(1, amped - armor);
  }

  /** Fey Mark: amplify all damage this enemy takes for a duration. */
  applyMark(mult: number, duration: number): void {
    this.ampMult = Math.max(this.ampMult, mult);
    this.ampTimer = Math.max(this.ampTimer, duration);
  }

  applySlow(factor: number, duration: number): void {
    if (this.type.slowImmune) return; // some enemies shrug off slows entirely
    // slow resistance claws back part of the speed loss: resist 0.6 turns a 0.5x chill into 0.8x
    const effective = 1 - (1 - factor) * (1 - this.slowResist);
    this.slowFactor = Math.min(this.slowFactor, effective);
    this.slowTimer = Math.max(this.slowTimer, duration);
  }

  applyPoison(dps: number, duration: number, contagion: Enemy['contagion'] = null): void {
    this.poisonDps = Math.max(this.poisonDps, dps);
    this.poisonTimer = Math.max(this.poisonTimer, duration);
    if (contagion) this.contagion = contagion;
  }

  applyRoot(duration: number): void {
    this.rootTimer = Math.max(this.rootTimer, duration);
  }

  get isDead(): boolean {
    return this.hp <= 0;
  }

  /** The waypoint this enemy is currently walking toward, or null if it finished. */
  get nextWaypoint(): Vec2 | null {
    return this.pathIndex < this.path.length ? this.path[this.pathIndex] : null;
  }
}
