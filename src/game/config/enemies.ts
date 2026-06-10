export interface EnemyType {
  id: string;
  name: string;
  maxHp: number;
  speed: number; // pixels per second
  reward: number; // gold granted when killed
  leakDamage: number; // lives lost if it reaches the base
  armor?: number; // flat per-hit damage reduction (default 0)
  regenPerSec?: number; // hp healed per second (default 0)
}

export const ENEMY_TYPES: Record<string, EnemyType> = {
  aswang: { id: 'aswang', name: 'Aswang', maxHp: 60, speed: 60, reward: 4, leakDamage: 1 },
  tiktik: { id: 'tiktik', name: 'Tiktik', maxHp: 30, speed: 110, reward: 2, leakDamage: 1 },
  kapre: { id: 'kapre', name: 'Kapre', maxHp: 120, speed: 45, reward: 7, leakDamage: 1, armor: 8 },
  tiyanak: { id: 'tiyanak', name: 'Tiyanak', maxHp: 18, speed: 130, reward: 1, leakDamage: 1 },
  manananggal: { id: 'manananggal', name: 'Manananggal', maxHp: 70, speed: 70, reward: 6, leakDamage: 1, regenPerSec: 6 },
};

// Enemies get tankier every wave (gold rewards stay fixed). Linear ramp: wave 1 = base HP,
// and each wave thereafter adds HP_GROWTH_PER_WAVE of the base. e.g. at +10%/wave a 60-HP
// Aswang is 60 at wave 1, 114 at wave 10, 234 at wave 30.
export const HP_GROWTH_PER_WAVE = 0.1;

export function scaledMaxHp(baseMaxHp: number, waveNumber: number): number {
  return Math.round(baseMaxHp * (1 + HP_GROWTH_PER_WAVE * Math.max(0, waveNumber - 1)));
}
