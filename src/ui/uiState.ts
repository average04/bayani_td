import type { HeroType } from '../game/config/heroes';
import type { GameStatus } from '../game/state/gameState';

export interface WorldLike {
  lives: number;
  gold: number;
  waveNumber: number;
  totalWaves: number;
  status: GameStatus;
  canStartNextWave(): boolean;
}

export interface HeroVM {
  id: string;
  name: string;
  cost: number;
  affordable: boolean;
  selected: boolean;
}

export interface UiState {
  lives: number;
  gold: number;
  wave: number;
  totalWaves: number;
  status: GameStatus;
  bestWave: number;
  canStartWave: boolean;
  selectedHeroId: string | null;
  heroes: HeroVM[];
}

export function canAfford(gold: number, cost: number): boolean {
  return gold >= cost;
}

export function buildUiState(
  world: WorldLike,
  selectedHeroId: string | null,
  bestWave: number,
  heroOrder: string[],
  heroTypes: Record<string, HeroType>,
): UiState {
  return {
    lives: world.lives,
    gold: world.gold,
    wave: world.waveNumber,
    totalWaves: world.totalWaves,
    status: world.status,
    bestWave,
    canStartWave: world.canStartNextWave(),
    selectedHeroId,
    heroes: heroOrder.map((id) => {
      const h = heroTypes[id];
      return {
        id,
        name: h.name,
        cost: h.cost,
        affordable: canAfford(world.gold, h.cost),
        selected: id === selectedHeroId,
      };
    }),
  };
}
