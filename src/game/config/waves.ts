export interface WaveSpawn {
  enemyTypeId: string;
  count: number;
  interval: number; // seconds between each spawn in this group
}

export interface WaveConfig {
  spawns: WaveSpawn[];
}

export const WAVES: WaveConfig[] = [
  { spawns: [{ enemyTypeId: 'aswang', count: 8, interval: 0.9 }] },
  {
    spawns: [
      { enemyTypeId: 'aswang', count: 6, interval: 0.8 },
      { enemyTypeId: 'tiktik', count: 6, interval: 0.6 },
    ],
  },
  {
    spawns: [
      { enemyTypeId: 'tiktik', count: 10, interval: 0.5 },
      { enemyTypeId: 'aswang', count: 8, interval: 0.7 },
    ],
  },
  // wave 4 — armored intro
  {
    spawns: [
      { enemyTypeId: 'kapre', count: 2, interval: 2 },
      { enemyTypeId: 'aswang', count: 6, interval: 0.7 },
    ],
  },
  // wave 5 — swarm
  {
    spawns: [
      { enemyTypeId: 'tiyanak', count: 14, interval: 0.35 },
      { enemyTypeId: 'tiktik', count: 6, interval: 0.5 },
    ],
  },
  // wave 6 — regen + mixed
  {
    spawns: [
      { enemyTypeId: 'manananggal', count: 3, interval: 1.5 },
      { enemyTypeId: 'kapre', count: 2, interval: 2 },
      { enemyTypeId: 'tiyanak', count: 10, interval: 0.4 },
    ],
  },
  // wave 7 — fast swarm
  {
    spawns: [
      { enemyTypeId: 'tiktik', count: 16, interval: 0.4 },
      { enemyTypeId: 'aswang', count: 10, interval: 0.6 },
    ],
  },
  // wave 8 — armored push
  {
    spawns: [
      { enemyTypeId: 'kapre', count: 4, interval: 1.4 },
      { enemyTypeId: 'aswang', count: 8, interval: 0.6 },
    ],
  },
  // wave 9 — regen + tiyanak swarm
  {
    spawns: [
      { enemyTypeId: 'manananggal', count: 5, interval: 1.2 },
      { enemyTypeId: 'tiyanak', count: 16, interval: 0.3 },
    ],
  },
  // wave 10 — heavy mix
  {
    spawns: [
      { enemyTypeId: 'kapre', count: 3, interval: 1.4 },
      { enemyTypeId: 'manananggal', count: 4, interval: 1.2 },
      { enemyTypeId: 'tiktik', count: 12, interval: 0.4 },
    ],
  },
  // wave 11 — huge swarm
  {
    spawns: [
      { enemyTypeId: 'tiyanak', count: 24, interval: 0.22 },
      { enemyTypeId: 'aswang', count: 8, interval: 0.5 },
    ],
  },
  // wave 12 — armored wall
  {
    spawns: [
      { enemyTypeId: 'kapre', count: 6, interval: 1.1 },
      { enemyTypeId: 'tiktik', count: 10, interval: 0.4 },
    ],
  },
  // wave 13 — regen wall
  {
    spawns: [
      { enemyTypeId: 'manananggal', count: 8, interval: 0.9 },
      { enemyTypeId: 'aswang', count: 10, interval: 0.5 },
    ],
  },
  // wave 14 — everything
  {
    spawns: [
      { enemyTypeId: 'kapre', count: 4, interval: 1.2 },
      { enemyTypeId: 'manananggal', count: 4, interval: 1.2 },
      { enemyTypeId: 'aswang', count: 10, interval: 0.45 },
      { enemyTypeId: 'tiktik', count: 10, interval: 0.4 },
      { enemyTypeId: 'tiyanak', count: 14, interval: 0.25 },
    ],
  },
  // wave 15 — heavy mix
  {
    spawns: [
      { enemyTypeId: 'kapre', count: 8, interval: 0.9 },
      { enemyTypeId: 'manananggal', count: 6, interval: 0.9 },
      { enemyTypeId: 'tiyanak', count: 20, interval: 0.22 },
    ],
  },
  // wave 16 — final onslaught
  {
    spawns: [
      { enemyTypeId: 'kapre', count: 10, interval: 0.8 },
      { enemyTypeId: 'manananggal', count: 8, interval: 0.8 },
      { enemyTypeId: 'aswang', count: 12, interval: 0.4 },
      { enemyTypeId: 'tiktik', count: 16, interval: 0.3 },
      { enemyTypeId: 'tiyanak', count: 22, interval: 0.18 },
    ],
  },
];

// Endless mode: authored waves for 1..16, then ever-escalating procedural waves.
export function generateWave(n: number): WaveConfig {
  if (n <= WAVES.length) return WAVES[n - 1];
  const t = n - WAVES.length; // tiers past the last authored wave (1, 2, 3, …)
  const grow = (base: number, per: number): number => base + per * t;
  const tighten = (base: number, per: number, min: number): number => Math.max(min, base - per * t);
  return {
    spawns: [
      { enemyTypeId: 'kapre', count: grow(6, 2), interval: tighten(0.9, 0.03, 0.4) },
      { enemyTypeId: 'manananggal', count: grow(5, 2), interval: tighten(0.8, 0.03, 0.4) },
      { enemyTypeId: 'aswang', count: grow(10, 3), interval: tighten(0.4, 0.02, 0.2) },
      { enemyTypeId: 'tiktik', count: grow(12, 3), interval: tighten(0.3, 0.01, 0.15) },
      { enemyTypeId: 'tiyanak', count: grow(18, 4), interval: tighten(0.2, 0.01, 0.1) },
    ],
  };
}
