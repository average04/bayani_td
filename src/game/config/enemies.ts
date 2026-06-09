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
  aswang: { id: 'aswang', name: 'Aswang', maxHp: 60, speed: 60, reward: 10, leakDamage: 1 },
  tiktik: { id: 'tiktik', name: 'Tiktik', maxHp: 30, speed: 110, reward: 6, leakDamage: 1 },
  kapre: { id: 'kapre', name: 'Kapre', maxHp: 120, speed: 45, reward: 18, leakDamage: 1, armor: 8 },
  tiyanak: { id: 'tiyanak', name: 'Tiyanak', maxHp: 18, speed: 130, reward: 4, leakDamage: 1 },
  manananggal: { id: 'manananggal', name: 'Manananggal', maxHp: 70, speed: 70, reward: 16, leakDamage: 1, regenPerSec: 6 },
};
