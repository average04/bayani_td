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
}

export const HERO_TYPES: Record<string, HeroType> = {
  lapulapu: { id: 'lapulapu', name: 'Lapu-Lapu', cost: 100, range: 110, damage: 20, fireRate: 1 },
  gabriela: { id: 'gabriela', name: 'Gabriela Silang', cost: 75, range: 140, damage: 6, fireRate: 3 },
  bernardo: { id: 'bernardo', name: 'Bernardo Carpio', cost: 120, range: 100, damage: 12, fireRate: 1.2, splashRadius: 50 },
  diwata: { id: 'diwata', name: 'Diwata', cost: 90, range: 130, damage: 4, fireRate: 1.5, slow: { factor: 0.5, duration: 1.5 } },
  mangkukulam: { id: 'mangkukulam', name: 'Mangkukulam', cost: 110, range: 120, damage: 5, fireRate: 1, poison: { dps: 8, duration: 3 } },
};
