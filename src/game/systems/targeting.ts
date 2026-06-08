import type { Tower } from '../entities/tower';
import type { Enemy } from '../entities/enemy';
import { distance } from '../geometry';

export function selectTarget(tower: Tower, enemies: Enemy[]): Enemy | null {
  let best: Enemy | null = null;
  for (const e of enemies) {
    if (e.isDead || e.reachedEnd) continue;
    if (!tower.inRange(e.pos)) continue;
    if (best === null || isFurtherAlong(e, best)) {
      best = e;
    }
  }
  return best;
}

function isFurtherAlong(a: Enemy, b: Enemy): boolean {
  // A higher pathIndex means the enemy has passed more waypoints.
  if (a.pathIndex !== b.pathIndex) return a.pathIndex > b.pathIndex;
  // Same segment: whichever is closer to its next waypoint is further along.
  const an = a.nextWaypoint;
  const bn = b.nextWaypoint;
  if (an === null || bn === null) return false;
  return distance(a.pos, an) < distance(b.pos, bn);
}
