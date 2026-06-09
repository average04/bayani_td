import type { HeroType } from '../game/config/heroes';
import type { GameStatus } from '../game/state/gameState';
import { UPGRADES, nextUpgrade, canUpgradePath } from '../game/config/upgrades';
import { HERO_TYPES } from '../game/config/heroes';

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

export interface UpgradePathVM {
  name: string;
  level: number; // 0-4
  next: { name: string; cost: number } | null;
  locked: boolean; // has a next level but the cross-path rule blocks it
  canBuy: boolean; // rule-allowed AND affordable
}

export interface UpgradePanelVM {
  heroId: string;
  heroName: string;
  paths: [UpgradePathVM, UpgradePathVM];
}

export function buildUpgradePanel(
  heroId: string,
  levels: readonly [number, number],
  gold: number,
): UpgradePanelVM | null {
  const paths = UPGRADES[heroId];
  const hero = HERO_TYPES[heroId];
  if (!paths || !hero) return null;
  const mk = (p: number): UpgradePathVM => {
    const up = nextUpgrade(hero, levels, p);
    const ruleOk = canUpgradePath(levels, p);
    return {
      name: paths[p].name,
      level: levels[p],
      next: up ? { name: up.name, cost: up.cost } : null,
      locked: up !== null && !ruleOk,
      canBuy: up !== null && ruleOk && gold >= up.cost,
    };
  };
  return { heroId, heroName: hero.name, paths: [mk(0), mk(1)] };
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
