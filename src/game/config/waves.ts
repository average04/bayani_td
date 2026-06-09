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
];
