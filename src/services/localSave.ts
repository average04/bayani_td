import { isValidLoadout } from '../game/config/loadout';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface SaveData {
  bestWave: number;
  loadout?: string[]; // last hero-card loadout, if a valid one was saved
}

const KEY = 'bayani-td-save';

function defaultStorage(): StorageLike {
  return globalThis.localStorage;
}

export function loadSave(storage: StorageLike = defaultStorage()): SaveData {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return { bestWave: 0 };
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    return {
      bestWave: typeof parsed.bestWave === 'number' ? parsed.bestWave : 0,
      loadout: isValidLoadout(parsed.loadout) ? parsed.loadout : undefined,
    };
  } catch {
    return { bestWave: 0 };
  }
}

function write(data: SaveData, storage: StorageLike): void {
  storage.setItem(KEY, JSON.stringify(data));
}

export function saveBestWave(wave: number, storage: StorageLike = defaultStorage()): void {
  const current = loadSave(storage);
  if (wave > current.bestWave) {
    write({ ...current, bestWave: wave }, storage);
  }
}

export function saveLoadout(loadout: string[], storage: StorageLike = defaultStorage()): void {
  if (!isValidLoadout(loadout)) return;
  write({ ...loadSave(storage), loadout }, storage);
}
