import { describe, it, expect } from 'vitest';
import { Economy } from '../../../src/game/systems/economy';

describe('Economy', () => {
  it('starts with the given gold', () => {
    expect(new Economy(150).gold).toBe(150);
  });

  it('spends gold when affordable and refuses when not', () => {
    const eco = new Economy(100);
    expect(eco.spend(75)).toBe(true);
    expect(eco.gold).toBe(25);
    expect(eco.spend(50)).toBe(false);
    expect(eco.gold).toBe(25);
  });

  it('earns gold', () => {
    const eco = new Economy(0);
    eco.earn(10);
    expect(eco.gold).toBe(10);
  });
});
