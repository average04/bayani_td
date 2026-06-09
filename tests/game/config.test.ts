import { describe, it, expect } from 'vitest';
import { ENEMY_TYPES } from '../../src/game/config/enemies';
import { HERO_TYPES } from '../../src/game/config/heroes';
import { WAVES } from '../../src/game/config/waves';

describe('config data', () => {
  it('includes the new heroes and enemies', () => {
    for (const id of ['bernardo', 'diwata', 'mangkukulam']) expect(HERO_TYPES[id]).toBeDefined();
    for (const id of ['kapre', 'tiyanak', 'manananggal']) expect(ENEMY_TYPES[id]).toBeDefined();
  });

  it('every wave spawn references a defined enemy type with a positive count', () => {
    for (const wave of WAVES) {
      for (const spawn of wave.spawns) {
        expect(ENEMY_TYPES[spawn.enemyTypeId], spawn.enemyTypeId).toBeDefined();
        expect(spawn.count).toBeGreaterThan(0);
      }
    }
  });
});
