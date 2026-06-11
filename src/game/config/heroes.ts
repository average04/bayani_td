export interface HeroTrait {
  name: string;
  desc: string;
}

export interface HeroType {
  id: string;
  name: string;
  cost: number;
  range: number; // pixels
  damage: number; // per shot
  fireRate: number; // shots per second
  splashRadius?: number; // if set, damage all enemies within this radius of the target
  slow?: { factor: number; duration: number }; // on-hit speed multiplier for a duration
  // on-hit damage-over-time (ignores armor); hpFracPerSec adds % of the victim's max HP per second
  poison?: { dps: number; duration: number; hpFracPerSec?: number };
  spin?: boolean; // melee spin: each swing hits ALL enemies within `range` of the hero itself (no single target)
  trait?: HeroTrait; // unique signature passive, described in the UI
  // every Nth shot is special: multiplies damage (crit) and/or echoes the hit a moment later
  rhythm?: { every: number; damageMult?: number; echo?: { delay: number; frac: number } };
  mark?: { amp: number }; // hits that slow also amplify ALL damage the enemy takes while slowed
  contagion?: { radius: number; maxTargets: number; minDuration: number }; // poison jumps on death
  pierce?: boolean; // shots ignore armor
  firstStrike?: number; // damage multiplier vs enemies at >=90% HP
  aura?: { damageAmp: number }; // OTHER towers within his range deal bonus damage (strongest aura wins)
  burnAura?: { radius: number; dps: number }; // enemies near him take true damage over time
  mobile?: { speed: number }; // roaming tower: chases the nearest enemy, returns to his camp when clear
}

export const HERO_TYPES: Record<string, HeroType> = {
  // melee spin: short range, heavy slow swings, hits everything ~1 block around him
  lapulapu: {
    id: 'lapulapu', name: 'Lapu-Lapu', cost: 100, range: 80, damage: 28, fireRate: 0.6, spin: true, // 0.6/s = one swing every ~1.67s
    rhythm: { every: 4, damageMult: 2 },
    trait: { name: 'Rampage', desc: 'Every 4th spin strikes for double damage' },
  },
  gabriela: {
    id: 'gabriela', name: 'Gabriela Silang', cost: 75, range: 140, damage: 10, fireRate: 3.6,
    rhythm: { every: 5, damageMult: 3 },
    trait: { name: 'Deadeye', desc: 'Every 5th shot crits for 3x damage' },
  },
  bernardo: {
    id: 'bernardo', name: 'Bernardo Carpio', cost: 120, range: 100, damage: 18, fireRate: 1.2, splashRadius: 50,
    rhythm: { every: 3, echo: { delay: 0.45, frac: 0.5 } },
    trait: { name: 'Aftershock', desc: 'Every 3rd boulder quakes again for 50% splash damage' },
  },
  diwata: {
    id: 'diwata', name: 'Diwata', cost: 90, range: 130, damage: 12, fireRate: 1.4, slow: { factor: 0.6, duration: 1.5 },
    mark: { amp: 0.15 },
    trait: { name: 'Fey Mark', desc: 'Enemies she slows take +15% damage from all sources' },
  },
  mangkukulam: {
    id: 'mangkukulam', name: 'Mangkukulam', cost: 110, range: 120, damage: 13, fireRate: 0.8, poison: { dps: 8, duration: 3 },
    contagion: { radius: 70, maxTargets: 2, minDuration: 1.5 },
    trait: { name: 'Contagion', desc: 'Poisoned enemies spread their curse to nearby foes on death' },
  },
  apolaki: {
    id: 'apolaki', name: 'Apolaki', cost: 130, range: 210, damage: 45, fireRate: 0.45,
    pierce: true,
    firstStrike: 1.5,
    trait: { name: 'Sunpierce', desc: 'Sun lances ignore armor and deal +50% to unhurt enemies' },
  },
  rizal: {
    id: 'rizal', name: 'Jose Rizal', cost: 110, range: 150, damage: 15, fireRate: 1.0,
    aura: { damageAmp: 0.1 },
    trait: { name: 'Inspiration', desc: 'Heroes in his range deal +10% damage (strongest aura applies)' },
  },
  bonifacio: {
    id: 'bonifacio', name: 'Andres Bonifacio', cost: 120, range: 50, damage: 20, fireRate: 1.2,
    mobile: { speed: 85 },
    burnAura: { radius: 60, dps: 6 },
    trait: { name: "Revolution's Flame", desc: 'Hunts the front-most enemy; his burning aura sears foes around him' },
  },
};

export const HERO_ORDER = ['lapulapu', 'gabriela', 'bernardo', 'diwata', 'mangkukulam', 'apolaki', 'rizal', 'bonifacio'];
