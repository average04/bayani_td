import { HERO_TYPES, HERO_ORDER } from './heroes';

// The deck of hero cards the player brings into a run. Chosen on the hero-select screen
// before the Phaser game boots; the build bar and GameScene hotkeys both read it here.
export const LOADOUT_SIZE = 4;

let current: string[] = HERO_ORDER.slice(0, LOADOUT_SIZE);

export function isValidLoadout(ids: unknown): ids is string[] {
  return (
    Array.isArray(ids) &&
    ids.length === LOADOUT_SIZE &&
    new Set(ids).size === LOADOUT_SIZE &&
    ids.every((id) => typeof id === 'string' && id in HERO_TYPES)
  );
}

export function setLoadout(ids: string[]): boolean {
  if (!isValidLoadout(ids)) return false;
  current = [...ids];
  return true;
}

export function getLoadout(): string[] {
  return [...current];
}
