import { describe, it, expect } from 'vitest';
import { facingFromDelta } from '../../src/render/facing';

describe('facingFromDelta', () => {
  it('faces down when idle', () => {
    expect(facingFromDelta(0, 0)).toEqual({ facing: 'down', flipX: false });
  });

  it('uses vertical facing when |dy| > |dx|', () => {
    expect(facingFromDelta(1, 5)).toEqual({ facing: 'down', flipX: false });
    expect(facingFromDelta(-1, -5)).toEqual({ facing: 'up', flipX: false });
  });

  it('uses side facing (flipped for left) when |dx| >= |dy|', () => {
    expect(facingFromDelta(5, 0)).toEqual({ facing: 'side', flipX: false });
    expect(facingFromDelta(-5, 1)).toEqual({ facing: 'side', flipX: true });
  });
});
