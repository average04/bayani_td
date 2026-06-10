import { describe, it, expect } from 'vitest';
import { SEND_TABLE, canSend } from '../../src/game/config/sends';
import { ENEMY_TYPES } from '../../src/game/config/enemies';
import { World } from '../../src/game/world';
import type { LevelConfig } from '../../src/game/config/levels';

const level: LevelConfig = {
  id: 't', name: 'T', tileSize: 48, cols: 16, rows: 10, cellSize: 24,
  path: [{ x: 0, y: 0 }, { x: 700, y: 0 }],
  startingGold: 100, startingLives: 20,
};

describe('send table', () => {
  it('every entry references a real enemy type', () => {
    for (const o of SEND_TABLE) expect(ENEMY_TYPES[o.enemyTypeId], o.enemyTypeId).toBeDefined();
  });

  it('canSend gates on gold AND unlock wave', () => {
    const tiyanak = SEND_TABLE[0]; // cost 25, unlock 1
    const kapre = SEND_TABLE.find((o) => o.enemyTypeId === 'kapre')!; // unlock 9
    expect(canSend(tiyanak, 100, 1)).toBe(true);
    expect(canSend(tiyanak, 10, 1)).toBe(false); // poor
    expect(canSend(kapre, 1000, 5)).toBe(false); // locked
    expect(canSend(kapre, 1000, 9)).toBe(true);
  });
});

describe('World.buySend', () => {
  it('debits gold on success and refuses when locked or poor', () => {
    const w = new World({ level, enemyTypes: ENEMY_TYPES, heroTypes: {}, waves: [{ spawns: [] }] });
    const tiyanak = SEND_TABLE[0];
    w.startNextWave(); // wave 1
    expect(w.buySend(tiyanak)).toBe(true);
    expect(w.gold).toBe(75);
    const bakunawa = SEND_TABLE.find((o) => o.enemyTypeId === 'bakunawa')!; // unlock 15
    expect(w.buySend(bakunawa)).toBe(false); // locked at wave 1
    expect(w.gold).toBe(75);
  });
});
