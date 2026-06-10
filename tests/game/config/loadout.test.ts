import { describe, it, expect } from 'vitest';
import { getLoadout, setLoadout, isValidLoadout, LOADOUT_SIZE } from '../../../src/game/config/loadout';
import { HERO_ORDER } from '../../../src/game/config/heroes';
import { loadSave, saveLoadout, saveBestWave, type StorageLike } from '../../../src/services/localSave';

function fakeStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
  };
}

describe('loadout config', () => {
  it('defaults to the first LOADOUT_SIZE heroes', () => {
    expect(getLoadout()).toEqual(HERO_ORDER.slice(0, LOADOUT_SIZE));
  });

  it('accepts only exactly-sized sets of unique known heroes', () => {
    expect(isValidLoadout(['lapulapu', 'gabriela', 'diwata', 'apolaki'])).toBe(true);
    expect(isValidLoadout(['lapulapu', 'gabriela', 'diwata'])).toBe(false); // too few
    expect(isValidLoadout(['lapulapu', 'lapulapu', 'diwata', 'apolaki'])).toBe(false); // dupe
    expect(isValidLoadout(['lapulapu', 'gabriela', 'diwata', 'nobody'])).toBe(false); // unknown
    expect(isValidLoadout('lapulapu')).toBe(false);
  });

  it('setLoadout applies valid loadouts and rejects invalid ones', () => {
    const prev = getLoadout();
    expect(setLoadout(['mangkukulam', 'apolaki', 'diwata', 'gabriela'])).toBe(true);
    expect(getLoadout()).toEqual(['mangkukulam', 'apolaki', 'diwata', 'gabriela']);
    expect(setLoadout(['bad'])).toBe(false);
    expect(getLoadout()).toEqual(['mangkukulam', 'apolaki', 'diwata', 'gabriela']);
    setLoadout(prev); // restore for other tests
  });
});

describe('loadout persistence', () => {
  it('round-trips a loadout and keeps it when bestWave is saved later', () => {
    const store = fakeStorage();
    saveLoadout(['lapulapu', 'bernardo', 'diwata', 'apolaki'], store);
    expect(loadSave(store).loadout).toEqual(['lapulapu', 'bernardo', 'diwata', 'apolaki']);
    saveBestWave(7, store);
    expect(loadSave(store)).toEqual({ bestWave: 7, loadout: ['lapulapu', 'bernardo', 'diwata', 'apolaki'] });
  });

  it('ignores invalid stored loadouts', () => {
    const store = fakeStorage();
    store.setItem('bayani-td-save', JSON.stringify({ bestWave: 2, loadout: ['x', 'y'] }));
    expect(loadSave(store).loadout).toBeUndefined();
  });

  it('refuses to save an invalid loadout', () => {
    const store = fakeStorage();
    saveLoadout(['x', 'y', 'z', 'w'], store);
    expect(loadSave(store).loadout).toBeUndefined();
  });
});
