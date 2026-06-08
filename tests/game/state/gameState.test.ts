import { describe, it, expect } from 'vitest';
import { GameState } from '../../../src/game/state/gameState';

describe('GameState', () => {
  it('starts playing with the given lives', () => {
    const s = new GameState(20);
    expect(s.lives).toBe(20);
    expect(s.status).toBe('playing');
  });

  it('loses lives and becomes lost at zero', () => {
    const s = new GameState(2);
    s.loseLife(1);
    expect(s.status).toBe('playing');
    s.loseLife(1);
    expect(s.lives).toBe(0);
    expect(s.status).toBe('lost');
  });

  it('can win only while still playing', () => {
    const s = new GameState(5);
    s.win();
    expect(s.status).toBe('won');
  });
});
