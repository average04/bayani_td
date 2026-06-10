export interface EnemyType {
  id: string;
  name: string;
  maxHp: number;
  speed: number; // pixels per second
  reward: number; // gold granted when killed
  leakDamage: number; // lives lost if it reaches the base
  armor?: number; // flat per-hit damage reduction (default 0)
  regenPerSec?: number; // hp healed per second (default 0)
  slowImmune?: boolean; // ignores slow effects entirely (default false)
}

export const ENEMY_TYPES: Record<string, EnemyType> = {
  aswang: { id: 'aswang', name: 'Aswang', maxHp: 60, speed: 60, reward: 4, leakDamage: 1 },
  tiktik: { id: 'tiktik', name: 'Tiktik', maxHp: 30, speed: 110, reward: 2, leakDamage: 1 },
  kapre: { id: 'kapre', name: 'Kapre', maxHp: 120, speed: 45, reward: 7, leakDamage: 1, armor: 8 },
  tiyanak: { id: 'tiyanak', name: 'Tiyanak', maxHp: 18, speed: 130, reward: 1, leakDamage: 1, slowImmune: true },
  manananggal: { id: 'manananggal', name: 'Manananggal', maxHp: 70, speed: 70, reward: 6, leakDamage: 1, regenPerSec: 6 },
};

// Enemies get tankier every wave (gold rewards stay fixed). A gentle linear ramp early
// (+HP_GROWTH_PER_WAVE of base per wave), then an extra COMPOUNDING ramp from wave 20 on so
// deep endless waves become real walls. e.g. a 60-HP Aswang: 114 @w10, 174 @w20, ~505 @w30.
export const HP_GROWTH_PER_WAVE = 0.1;
export const LATE_WAVE = 20; // the steeper ramp kicks in past this wave
export const LATE_HP_GROWTH_PER_WAVE = 0.08; // extra compounding growth per wave beyond LATE_WAVE

export function scaledMaxHp(baseMaxHp: number, waveNumber: number): number {
  let mult = 1 + HP_GROWTH_PER_WAVE * Math.max(0, waveNumber - 1);
  if (waveNumber > LATE_WAVE) {
    mult *= Math.pow(1 + LATE_HP_GROWTH_PER_WAVE, waveNumber - LATE_WAVE);
  }
  return Math.round(baseMaxHp * mult);
}
