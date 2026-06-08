export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface SaveData {
  bestWave: number;
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
    return { bestWave: typeof parsed.bestWave === 'number' ? parsed.bestWave : 0 };
  } catch {
    return { bestWave: 0 };
  }
}

export function saveBestWave(wave: number, storage: StorageLike = defaultStorage()): void {
  const current = loadSave(storage);
  if (wave > current.bestWave) {
    storage.setItem(KEY, JSON.stringify({ bestWave: wave }));
  }
}
