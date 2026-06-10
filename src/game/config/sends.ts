// Multiplayer send menu: spend gold to throw monsters at the opponent.
// unlockWave gates on the SENDER's current wave (spec). Costs are a first balance pass.
export interface SendOption {
  enemyTypeId: string;
  cost: number;
  unlockWave: number;
}

export const SEND_TABLE: SendOption[] = [
  { enemyTypeId: 'tiyanak', cost: 25, unlockWave: 1 },
  { enemyTypeId: 'tiktik', cost: 35, unlockWave: 2 },
  { enemyTypeId: 'aswang', cost: 50, unlockWave: 4 },
  { enemyTypeId: 'manananggal', cost: 90, unlockWave: 7 },
  { enemyTypeId: 'kapre', cost: 120, unlockWave: 9 },
  { enemyTypeId: 'bakunawa', cost: 500, unlockWave: 15 },
];

export function canSend(o: SendOption, gold: number, wave: number): boolean {
  return gold >= o.cost && wave >= o.unlockWave;
}
