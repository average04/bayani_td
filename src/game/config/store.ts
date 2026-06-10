// The Sari-Sari Store: a placeable economy building (Bloons "banana farm" equivalent).
// It does not attack; it generates passive gold on a timer while a game is in progress.
export const STORE = {
  id: 'store',
  name: 'Sari-Sari Store',
  cost: 150,
  maxCount: 2, // hard cap on stores per game
  width: 4, // cells (a 4x2 = "2x4 block" footprint)
  height: 2, // cells
  incomeInterval: 5, // seconds between payouts (base tick income)
  incomeAmount: 5, // gold per payout (base tick income)
  sellRefund: 0.5, // fraction of spent gold returned on sell
} as const;

// Effective income for a store: a periodic lump ("tick") plus a per-second drip ("passive").
export interface StoreIncome {
  tickInterval: number; // seconds between tick payouts
  tickAmount: number; // gold per tick payout
  passivePerSec: number; // gold trickled per second (granted once per second)
}

export interface StoreDelta {
  tickAmount?: number; // additive
  passivePerSec?: number; // additive
}

export interface StoreUpgradeLevel {
  name: string;
  cost: number;
  desc: string;
  delta: StoreDelta;
}

export interface StoreUpgradePath {
  name: string;
  levels: StoreUpgradeLevel[]; // exactly 4
}

// Two Bloons-style paths x 4 levels: bigger tick payouts vs. a growing passive drip.
export const STORE_UPGRADES: [StoreUpgradePath, StoreUpgradePath] = [
  {
    name: 'Bigger Sales',
    levels: [
      { name: 'Bulk Goods', cost: 200, desc: '+5 per payout', delta: { tickAmount: 5 } },
      { name: 'Wholesale', cost: 450, desc: '+10 per payout', delta: { tickAmount: 10 } },
      { name: 'Distributor', cost: 1000, desc: '+20 per payout', delta: { tickAmount: 20 } },
      { name: 'Mall', cost: 2200, desc: '+40 per payout', delta: { tickAmount: 40 } },
    ],
  },
  {
    name: 'Steady Trade',
    levels: [
      { name: 'Regulars', cost: 220, desc: '+1 gold/sec', delta: { passivePerSec: 1 } },
      { name: 'Loyal Patrons', cost: 500, desc: '+2 gold/sec', delta: { passivePerSec: 2 } },
      { name: 'Neighborhood Hub', cost: 1050, desc: '+3 gold/sec', delta: { passivePerSec: 3 } },
      { name: 'Franchise', cost: 2000, desc: '+5 gold/sec', delta: { passivePerSec: 5 } },
    ],
  },
];

export function baseStoreIncome(): StoreIncome {
  return { tickInterval: STORE.incomeInterval, tickAmount: STORE.incomeAmount, passivePerSec: 0 };
}

export function effectiveStoreIncome(levels: readonly [number, number]): StoreIncome {
  const inc = baseStoreIncome();
  for (let p = 0; p < 2; p++) {
    for (let lvl = 1; lvl <= levels[p]; lvl++) {
      const d = STORE_UPGRADES[p].levels[lvl - 1].delta;
      if (d.tickAmount) inc.tickAmount += d.tickAmount;
      if (d.passivePerSec) inc.passivePerSec += d.passivePerSec;
    }
  }
  return inc;
}

export function nextStoreUpgrade(levels: readonly [number, number], path: number): StoreUpgradeLevel | null {
  const cur = levels[path];
  if (cur >= 4) return null;
  return STORE_UPGRADES[path].levels[cur];
}
