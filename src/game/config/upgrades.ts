import type { HeroType } from './heroes';

export interface TowerStats {
  damage: number;
  range: number;
  fireRate: number;
  splashRadius?: number;
  slow?: { factor: number; duration: number };
  poison?: { dps: number; duration: number; hpFracPerSec?: number };
  root?: { chance: number; duration: number }; // chance (0-1) to immobilize a hit enemy for duration
  spin?: boolean;
  // unique-trait fields, copied from the hero definition (see heroes.ts)
  rhythm?: { every: number; damageMult?: number; echo?: { delay: number; frac: number } };
  mark?: { amp: number };
  contagion?: { radius: number; maxTargets: number; minDuration: number };
  pierce?: boolean;
  firstStrike?: number;
  aura?: { damageAmp: number };
  burnAura?: { radius: number; dps: number; hpFracPerSec?: number };
}

export interface StatDelta {
  damage?: number; // additive
  range?: number; // additive
  fireRate?: number; // additive
  splashRadius?: number; // additive
  slow?: { factor: number; duration: number }; // set
  // MERGED into the current poison (unlike the other status deltas): omitted fields keep
  // their value, so one path can raise the flat dps while the other adds splash/HP-burn
  poison?: Partial<{ dps: number; duration: number; hpFracPerSec: number }>;
  root?: { chance: number; duration: number }; // set
  aura?: { damageAmp: number }; // set
  burnAura?: { radius: number; dps: number; hpFracPerSec?: number }; // set
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

  // Gabriela — fast single-target shooter (base: dmg 11, range 140, rate 3.6).
  gabriela: [
    {
      name: 'Sharpshooter',
      levels: [
        { name: 'Steady Aim', cost: 55, desc: '+3 damage, +15 range', delta: { damage: 3, range: 15 } },
        { name: 'Marksman', cost: 110, desc: '+5 damage', delta: { damage: 5 } },
        { name: 'Piercing Shot', cost: 200, desc: '+10 damage, +20 range', delta: { damage: 10, range: 20 } },
        { name: 'Revolution', cost: 380, desc: '+20 damage, +30 range', delta: { damage: 20, range: 30 } },
      ],
    },
    {
      name: 'Rapid Fire',
      levels: [
        { name: 'Quick Reload', cost: 60, desc: '+1.0 attack speed', delta: { fireRate: 1.0 } },
        { name: 'Volley', cost: 120, desc: '+1.5 attack speed', delta: { fireRate: 1.5 } },
        { name: 'Suppressing Fire', cost: 210, desc: 'Shots splash r40', delta: { splashRadius: 40 } },
        { name: 'Katipunan Storm', cost: 400, desc: '+2.0 atk speed, +20 splash', delta: { fireRate: 2.0, splashRadius: 20 } },
      ],
    },
  ],

  // Bernardo — splash strongman (base: dmg 18, range 100, rate 1.2, splash 50).
  bernardo: [
    {
      name: 'Earthshaker',
      levels: [
        { name: 'Heavy Fists', cost: 70, desc: '+8 damage', delta: { damage: 8 } },
        { name: 'Tremor', cost: 130, desc: '+20 splash radius', delta: { splashRadius: 20 } },
        { name: 'Boulder Toss', cost: 240, desc: '+15 damage, +20 splash', delta: { damage: 15, splashRadius: 20 } },
        { name: 'Mountain Breaker', cost: 450, desc: '+40 damage, +30 splash', delta: { damage: 40, splashRadius: 30 } },
      ],
    },
    {
      name: 'Relentless',
      levels: [
        { name: 'Faster Swings', cost: 60, desc: '+0.5 attack speed', delta: { fireRate: 0.5 } },
        { name: 'Ground Pound', cost: 130, desc: '+0.8 attack speed', delta: { fireRate: 0.8 } },
        { name: 'Staggering Blow', cost: 220, desc: 'Hits Slow 0.6x / 1s', delta: { slow: { factor: 0.6, duration: 1 } } },
        { name: 'Unstoppable', cost: 420, desc: '+1.0 atk speed, Slow 0.5x / 1.5s', delta: { fireRate: 1.0, slow: { factor: 0.5, duration: 1.5 } } },
      ],
    },
  ],

  // Diwata — the slower. Deep Chill turns her slow into an AoE frost that chills whole groups;
  // Nature's Wrath entangles, with a growing chance to root enemies in place.
  // (base: dmg 12, range 130, rate 1.4, slow 0.5/1.5s, single target).
  diwata: [
    {
      // L1-2: pure slow. L3 unlocks the AoE frost (splash). Cross-path rule means only one
      // path can pass L2, so Diwata ends up with splash OR root, never both.
      name: 'Deep Chill',
      levels: [
        { name: 'Chilling Aura', cost: 60, desc: 'Slow 0.5x / 1.5s, +15 range', delta: { slow: { factor: 0.5, duration: 1.5 }, range: 15 } },
        { name: 'Deep Freeze', cost: 130, desc: 'Slow 0.4x / 2s, +10 range', delta: { slow: { factor: 0.4, duration: 2 }, range: 10 } },
        { name: 'Frost Nova', cost: 240, desc: 'Slow 0.3x / 2.5s, AoE splash r70', delta: { slow: { factor: 0.3, duration: 2.5 }, splashRadius: 70, range: 15 } },
        { name: 'Eternal Winter', cost: 430, desc: 'Slow 0.22x / 3s, AoE splash r110', delta: { slow: { factor: 0.22, duration: 3 }, splashRadius: 40 } },
      ],
    },
    {
      // L1-2: pure damage/speed. L3 unlocks roots (chance to immobilize).
      name: "Nature's Wrath",
      levels: [
        { name: 'Thorn Lash', cost: 55, desc: '+5 damage', delta: { damage: 5 } },
        { name: 'Quick Spirits', cost: 120, desc: '+1.0 attack speed', delta: { fireRate: 1.0 } },
        { name: 'Gnarled Roots', cost: 220, desc: '+10 dmg, 40% root 1.0s', delta: { damage: 10, root: { chance: 0.4, duration: 1.0 } } },
        { name: "Forest's Grasp", cost: 400, desc: '+22 dmg, 60% root 1.2s', delta: { damage: 22, root: { chance: 0.6, duration: 1.2 } } },
      ],
    },
  ],

  // Apolaki — armor-piercing sniper (base: dmg 45, range 210, rate 0.45, Sunpierce trait).
  apolaki: [
    {
      name: 'Solar Lance',
      levels: [
        { name: 'Focused Ray', cost: 70, desc: '+15 damage', delta: { damage: 15 } },
        { name: 'Dawnfire', cost: 140, desc: '+25 damage, +20 range', delta: { damage: 25, range: 20 } },
        { name: 'Noonday Wrath', cost: 260, desc: '+45 damage', delta: { damage: 45 } },
        { name: "War God's Spear", cost: 480, desc: '+90 damage, +30 range', delta: { damage: 90, range: 30 } },
      ],
    },
    {
      name: 'Zenith',
      levels: [
        { name: 'Quick Draw', cost: 65, desc: '+0.2 attack speed', delta: { fireRate: 0.2 } },
        { name: 'Blazing Pace', cost: 130, desc: '+0.25 attack speed', delta: { fireRate: 0.25 } },
        { name: 'Sunburst', cost: 240, desc: 'Lances splash r40', delta: { splashRadius: 40 } },
        { name: 'High Noon', cost: 430, desc: '+0.35 atk speed, +30 splash', delta: { fireRate: 0.35, splashRadius: 30 } },
      ],
    },
  ],

  // Jose Rizal — support (base: dmg 15, range 150, rate 1.0, aura +10% dmg to heroes in range).
  rizal: [
    {
      name: 'La Solidaridad',
      levels: [
        { name: 'Propaganda', cost: 70, desc: 'Aura +15% dmg, +10 range', delta: { aura: { damageAmp: 0.15 }, range: 10 } },
        { name: 'El Filibusterismo', cost: 150, desc: 'Aura +20% dmg', delta: { aura: { damageAmp: 0.2 } } },
        { name: 'La Liga Filipina', cost: 280, desc: 'Aura +26% dmg, +15 range', delta: { aura: { damageAmp: 0.26 }, range: 15 } },
        { name: 'National Hero', cost: 520, desc: 'Aura +35% dmg, +20 range', delta: { aura: { damageAmp: 0.35 }, range: 20 } },
      ],
    },
    {
      name: 'Man of Letters',
      levels: [
        { name: 'Sharp Critique', cost: 60, desc: '+6 damage', delta: { damage: 6 } },
        { name: 'Rapid Essays', cost: 120, desc: '+0.8 attack speed', delta: { fireRate: 0.8 } },
        { name: 'Banned Books', cost: 220, desc: 'Books splash r40 (ideas spread)', delta: { splashRadius: 40 } },
        { name: 'Mightier Than the Sword', cost: 400, desc: '+14 damage, +0.7 atk speed', delta: { damage: 14, fireRate: 0.7 } },
      ],
    },
  ],

  // Andres Bonifacio — roaming melee (base: dmg 20, range 50, rate 1.2, burn 6/s r60).
  bonifacio: [
    {
      name: 'Supremo',
      levels: [
        { name: 'Bolo Drill', cost: 65, desc: '+8 damage', delta: { damage: 8 } },
        { name: 'Fervor', cost: 130, desc: '+0.5 attack speed', delta: { fireRate: 0.5 } },
        { name: 'Cry of Balintawak', cost: 240, desc: '+14 damage, +0.5 atk speed', delta: { damage: 14, fireRate: 0.5 } },
        { name: 'Father of the Revolution', cost: 450, desc: '+30 damage, +0.5 atk speed', delta: { damage: 30, fireRate: 0.5 } },
      ],
    },
    {
      name: 'Pugad Lawin',
      levels: [
        { name: 'Kindled Torch', cost: 70, desc: 'Burn 10/s + 3% max HP/s, r65', delta: { burnAura: { radius: 65, dps: 10, hpFracPerSec: 0.03 } } },
        { name: 'Bonfire', cost: 150, desc: 'Burn 16/s + 3% max HP/s, r70', delta: { burnAura: { radius: 70, dps: 16, hpFracPerSec: 0.03 } } },
        { name: 'Blaze of Katipunan', cost: 280, desc: 'Burn 26/s + 3% max HP/s, r80', delta: { burnAura: { radius: 80, dps: 26, hpFracPerSec: 0.03 } } },
        { name: 'Wildfire', cost: 520, desc: 'Burn 40/s + 3% max HP/s, r95', delta: { burnAura: { radius: 95, dps: 40, hpFracPerSec: 0.03 } } },
      ],
    },
  ],

  // Mangkukulam — poison caster (base: dmg 13, range 120, rate 0.8, poison 8/3s).
  // Two distinct builds: Curse is the single-target HP-based melter; Dark Arts becomes
  // the AoE epidemic at tier 3 (Deadly Vials) — the vial splashes and curses everyone hit.
  mangkukulam: [
    {
      name: 'Curse',
      levels: [
        { name: 'Hex', cost: 60, desc: 'Poison 12/s, 3s', delta: { poison: { dps: 12, duration: 3 } } },
        { name: 'Wasting Curse', cost: 120, desc: 'Poison 18/s, 4s', delta: { poison: { dps: 18, duration: 4 } } },
        { name: 'Plague', cost: 220, desc: 'Poison 24/s + 6% max HP/s, 5s', delta: { poison: { dps: 24, duration: 5, hpFracPerSec: 0.06 } } },
        { name: 'Death Curse', cost: 410, desc: 'Poison 36/s + 8% max HP/s, 5s', delta: { poison: { dps: 36, duration: 5, hpFracPerSec: 0.08 } } },
      ],
    },
    {
      name: 'Dark Arts',
      levels: [
        { name: 'Quick Hexes', cost: 55, desc: '+0.5 attack speed', delta: { fireRate: 0.5 } },
        { name: 'Cursed Bolt', cost: 110, desc: '+6 damage', delta: { damage: 6 } },
        { name: 'Deadly Vials', cost: 210, desc: 'Vials splash r45 — your poison hits everyone, +3% max HP/s, 7s', delta: { splashRadius: 45, poison: { duration: 7, hpFracPerSec: 0.03 } } },
        { name: 'Malediction', cost: 390, desc: '+0.8 atk speed, +12 dmg; vial plague 4% max HP/s, 8s', delta: { fireRate: 0.8, damage: 12, poison: { duration: 8, hpFracPerSec: 0.04 } } },
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
    rhythm: hero.rhythm,
    mark: hero.mark,
    contagion: hero.contagion,
    pierce: hero.pierce,
    firstStrike: hero.firstStrike,
    aura: hero.aura,
    burnAura: hero.burnAura,
  };
}

function applyDelta(s: TowerStats, d: StatDelta): void {
  if (d.damage) s.damage += d.damage;
  if (d.range) s.range += d.range;
  if (d.fireRate) s.fireRate += d.fireRate;
  if (d.splashRadius) s.splashRadius = (s.splashRadius ?? 0) + d.splashRadius;
  if (d.slow) s.slow = d.slow;
  if (d.poison) {
    const cur = s.poison ?? { dps: 0, duration: 0 };
    s.poison = {
      dps: d.poison.dps ?? cur.dps,
      duration: d.poison.duration ?? cur.duration,
      hpFracPerSec: d.poison.hpFracPerSec ?? cur.hpFracPerSec,
    };
  }
  if (d.root) s.root = d.root;
  if (d.aura) s.aura = d.aura;
  if (d.burnAura) s.burnAura = d.burnAura;
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
