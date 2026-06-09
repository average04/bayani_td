import type { HeroType } from './heroes';

export interface TowerStats {
  damage: number;
  range: number;
  fireRate: number;
  splashRadius?: number;
  slow?: { factor: number; duration: number };
  poison?: { dps: number; duration: number };
  spin?: boolean;
}

export interface StatDelta {
  damage?: number; // additive
  range?: number; // additive
  fireRate?: number; // additive
  splashRadius?: number; // additive
  slow?: { factor: number; duration: number }; // set
  poison?: { dps: number; duration: number }; // set
}

export interface UpgradeLevel {
  name: string;
  cost: number;
  desc: string;
  delta: StatDelta;
}

export interface UpgradePath {
  name: string;
  levels: UpgradeLevel[]; // exactly 4
}

export type HeroUpgrades = [UpgradePath, UpgradePath];

export const UPGRADES: Record<string, HeroUpgrades> = {
  lapulapu: [
    {
      name: 'Conqueror',
      levels: [
        { name: 'Sharpened Bolo', cost: 60, desc: '+12 damage', delta: { damage: 12 } },
        { name: "Warrior's Might", cost: 120, desc: '+20 damage, +10 range', delta: { damage: 20, range: 10 } },
        { name: "Datu's Fury", cost: 220, desc: '+35 damage', delta: { damage: 35 } },
        { name: 'Hero of Mactan', cost: 420, desc: '+70 damage, +15 range', delta: { damage: 70, range: 15 } },
      ],
    },
    {
      name: 'Whirlwind',
      levels: [
        { name: 'Quick Strikes', cost: 50, desc: '+0.3 attack speed', delta: { fireRate: 0.3 } },
        { name: 'Cyclone', cost: 110, desc: '+0.4 attack speed', delta: { fireRate: 0.4 } },
        { name: 'Dizzying Spin', cost: 190, desc: 'Slow 0.65x / 1s', delta: { slow: { factor: 0.65, duration: 1 } } },
        { name: 'Tempest', cost: 360, desc: '+0.5 atk speed, Slow 0.5x / 1.5s', delta: { fireRate: 0.5, slow: { factor: 0.5, duration: 1.5 } } },
      ],
    },
  ],
};

export function baseStats(hero: HeroType): TowerStats {
  return {
    damage: hero.damage,
    range: hero.range,
    fireRate: hero.fireRate,
    splashRadius: hero.splashRadius,
    slow: hero.slow,
    poison: hero.poison,
    spin: hero.spin,
  };
}

function applyDelta(s: TowerStats, d: StatDelta): void {
  if (d.damage) s.damage += d.damage;
  if (d.range) s.range += d.range;
  if (d.fireRate) s.fireRate += d.fireRate;
  if (d.splashRadius) s.splashRadius = (s.splashRadius ?? 0) + d.splashRadius;
  if (d.slow) s.slow = d.slow;
  if (d.poison) s.poison = d.poison;
}

export function effectiveStats(hero: HeroType, levels: readonly [number, number]): TowerStats {
  const s = baseStats(hero);
  const paths = UPGRADES[hero.id];
  if (!paths) return s;
  for (let p = 0; p < 2; p++) {
    for (let lvl = 1; lvl <= levels[p]; lvl++) applyDelta(s, paths[p].levels[lvl - 1].delta);
  }
  return s;
}

export function nextUpgrade(hero: HeroType, levels: readonly [number, number], path: number): UpgradeLevel | null {
  const paths = UPGRADES[hero.id];
  if (!paths) return null;
  const cur = levels[path];
  if (cur >= 4) return null;
  return paths[path].levels[cur];
}

// Bloons-style: a path may pass level 2 only while the other path stays <= 2.
export function canUpgradePath(levels: readonly [number, number], path: number): boolean {
  const cur = levels[path];
  if (cur >= 4) return false;
  const other = levels[path === 0 ? 1 : 0];
  if (cur + 1 >= 3 && other > 2) return false;
  return true;
}
