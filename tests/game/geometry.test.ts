import { describe, it, expect } from 'vitest';
import { distance } from '../../src/game/geometry';

describe('distance', () => {
  it('computes euclidean distance between two points', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('is zero for identical points', () => {
    expect(distance({ x: 7, y: 2 }, { x: 7, y: 2 })).toBe(0);
  });
});
