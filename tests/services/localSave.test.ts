import { describe, it, expect } from 'vitest';
import { loadSave, saveBestWave, type StorageLike } from '../../src/services/localSave';

function fakeStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
  };
}

describe('localSave', () => {
  it('returns bestWave 0 when nothing is stored', () => {
    expect(loadSave(fakeStorage())).toEqual({ bestWave: 0 });
  });

  it('persists a new best wave but not a worse one', () => {
    const store = fakeStorage();
    saveBestWave(3, store);
    expect(loadSave(store).bestWave).toBe(3);
    saveBestWave(2, store);
    expect(loadSave(store).bestWave).toBe(3);
    saveBestWave(5, store);
    expect(loadSave(store).bestWave).toBe(5);
  });

  it('recovers gracefully from corrupt data', () => {
    const store = fakeStorage();
    store.setItem('bayani-td-save', 'not json');
    expect(loadSave(store)).toEqual({ bestWave: 0 });
  });
});
