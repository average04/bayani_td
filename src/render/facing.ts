import type { Facing } from '../assets/manifest';

export type { Facing };

export interface FacingResult {
  facing: Facing;
  flipX: boolean;
}

export function facingFromDelta(dx: number, dy: number): FacingResult {
  if (dx === 0 && dy === 0) return { facing: 'down', flipX: false };
  if (Math.abs(dy) > Math.abs(dx)) {
    return { facing: dy > 0 ? 'down' : 'up', flipX: false };
  }
  return { facing: 'side', flipX: dx < 0 };
}
