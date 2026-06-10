export interface HeroType {
  id: string;
  name: string;
  cost: number;
  range: number; // pixels
  damage: number; // per shot
  fireRate: number; // shots per second
  splashRadius?: number; // if set, damage all enemies within this radius of the target
  slow?: { factor: number; duration: number }; // on-hit speed multiplier for a duration
  poison?: { dps: number; duration: number }; // on-hit damage-over-time (ignores armor)
  spin?: boolean; // melee spin: each swing hits ALL enemies within `range` of the hero itself (no single target)
}

export const HERO_TYPES: Record<string, HeroType> = {
  // melee spin: short range, heavy slow swings, hits everything ~1 block around him
  lapulapu: { id: 'lapulapu', name: 'Lapu-Lapu', cost: 100, range: 80, damage: 30, fireRate: 0.5, spin: true }, // 0.5/s = one swing every 2s
  gabriela: { id: 'gabriela', name: 'Gabriela Silang', cost: 75, range: 140, damage: 12, fireRate: 3 },
  bernardo: { id: 'bernardo', name: 'Bernardo Carpio', cost: 120, range: 100, damage: 15, fireRate: 1.2, splashRadius: 50 },
  diwata: { id: 'diwata', name: 'Diwata', cost: 90, range: 130, damage: 12, fireRate: 1, slow: { factor: 0.5, duration: 1.5 } },
  mangkukulam: { id: 'mangkukulam', name: 'Mangkukulam', cost: 110, range: 120, damage: 10, fireRate: 0.8, poison: { dps: 8, duration: 3 } },
};

export const HERO_ORDER = ['lapulapu', 'gabriela', 'bernardo', 'diwata', 'mangkukulam'];
