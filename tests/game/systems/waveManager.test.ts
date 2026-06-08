import { describe, it, expect } from 'vitest';
import { WaveManager } from '../../../src/game/systems/waveManager';
import type { WaveConfig } from '../../../src/game/config/waves';

const waves: WaveConfig[] = [
  { spawns: [{ enemyTypeId: 'a', count: 2, interval: 1 }] },
  { spawns: [{ enemyTypeId: 'b', count: 1, interval: 1 }] },
];

describe('WaveManager', () => {
  it('reports total waves and starts before any wave', () => {
    const wm = new WaveManager(waves);
    expect(wm.totalWaves).toBe(2);
    expect(wm.currentWaveNumber).toBe(0);
    expect(wm.canStartNextWave()).toBe(true);
  });

  it('emits spawns on the configured interval', () => {
    const wm = new WaveManager(waves);
    wm.startNextWave();
    expect(wm.currentWaveNumber).toBe(1);
    expect(wm.update(1)).toEqual(['a']); // first spawn after interval
    expect(wm.update(0.5)).toEqual([]); // not yet
    expect(wm.update(0.5)).toEqual(['a']); // second spawn
    expect(wm.isSpawning).toBe(false);
  });

  it('cannot start the next wave while still spawning', () => {
    const wm = new WaveManager(waves);
    wm.startNextWave();
    wm.update(1); // one of two emitted, still spawning
    expect(wm.canStartNextWave()).toBe(false);
  });

  it('is complete after the last wave finishes spawning', () => {
    const wm = new WaveManager(waves);
    wm.startNextWave();
    wm.update(2); // drain wave 1
    wm.startNextWave();
    wm.update(1); // drain wave 2
    expect(wm.isComplete).toBe(true);
    expect(wm.hasMoreWaves).toBe(false);
  });
});
