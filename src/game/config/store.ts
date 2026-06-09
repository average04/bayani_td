// The Sari-Sari Store: a placeable economy building (Bloons "banana farm" equivalent).
// It does not attack; it generates passive gold on a timer while a game is in progress.
export const STORE = {
  id: 'store',
  name: 'Sari-Sari Store',
  cost: 150,
  width: 4, // cells (a 4x2 = "2x4 block" footprint)
  height: 2, // cells
  incomeInterval: 3, // seconds between payouts
  incomeAmount: 12, // gold per payout
} as const;
