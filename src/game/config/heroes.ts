export interface HeroType {
  id: string;
  name: string;
  cost: number;
  range: number; // pixels
  damage: number; // per shot
  fireRate: number; // shots per second
}

export const HERO_TYPES: Record<string, HeroType> = {
  lapulapu: { id: 'lapulapu', name: 'Lapu-Lapu', cost: 100, range: 110, damage: 20, fireRate: 1 },
  gabriela: { id: 'gabriela', name: 'Gabriela Silang', cost: 75, range: 140, damage: 6, fireRate: 3 },
};
