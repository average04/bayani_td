import type { Tower, TargetMode } from '../entities/tower';
import type { Enemy } from '../entities/enemy';
import { distance } from '../geometry';

export function selectTarget(tower: Tower, enemies: Enemy[]): Enemy | null {
  let best: Enemy | null = null;
  for (const e of enemies) {
    if (e.isDead || e.reachedEnd) continue;
    if (!tower.inRange(e.pos)) continue;
    if (best === null || preferred(e, best, tower, tower.targetMode)) best = e;
  }
  return best;
}

function preferred(e: Enemy, best: Enemy, tower: Tower, mode: TargetMode): boolean {
  switch (mode) {
    case 'first':
      return isFurtherAlong(e, best);
    case 'last':
      return isFurtherAlong(best, e);
    case 'strong':
      return e.hp > best.hp;
    case 'close':
      return distance(tower.pos, e.pos) < distance(tower.pos, best.pos);
  }
}

export function isFurtherAlong(a: Enemy, b: Enemy): boolean {
  // A higher pathIndex means the enemy has passed more waypoints.
  if (a.pathIndex !== b.pathIndex) return a.pathIndex > b.pathIndex;
  // Same segment: whichever is closer to its next waypoint is further along.
  const an = a.nextWaypoint;
  const bn = b.nextWaypoint;
  if (an === null || bn === null) return false;
  return distance(a.pos, an) < distance(b.pos, bn);
}
