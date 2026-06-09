import type { HeroType } from '../game/config/heroes';
import type { GameStatus } from '../game/state/gameState';
import { UPGRADES, nextUpgrade, canUpgradePath, effectiveStats, type TowerStats } from '../game/config/upgrades';
import { HERO_TYPES } from '../game/config/heroes';
import { STORE, STORE_UPGRADES, nextStoreUpgrade, effectiveStoreIncome } from '../game/config/store';
import type { TargetMode } from '../game/entities/tower';

export interface WorldLike {
  lives: number;
  gold: number;
  waveNumber: number;
  totalWaves: number;
  status: GameStatus;
  nextWaveIn: number | null;
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
  nextWaveIn: number | null;
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
  stats: { damage: number; range: number; fireRate: number; effect: string };
  sellValue: number;
  targetMode: TargetMode | null; // null = no targeting (e.g. spin/AoE-self heroes)
  paths: [UpgradePathVM, UpgradePathVM];
}

function statsEffect(s: TowerStats): string {
  if (s.spin) return 'Melee spin';
  if (s.splashRadius) return `Splash r${s.splashRadius}`;
  if (s.slow) return `Slow x${s.slow.factor} / ${s.slow.duration}s`;
  if (s.poison) return `Poison ${s.poison.dps}/s`;
  return 'Single target';
}

export function buildUpgradePanel(
  heroId: string,
  levels: readonly [number, number],
  gold: number,
  spent = 0,
  targetMode: TargetMode = 'first',
): UpgradePanelVM | null {
  const paths = UPGRADES[heroId];
  const hero = HERO_TYPES[heroId];
  if (!paths || !hero) return null;
  const eff = effectiveStats(hero, levels);
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
  return {
    heroId,
    heroName: hero.name,
    stats: { damage: eff.damage, range: eff.range, fireRate: eff.fireRate, effect: statsEffect(eff) },
    sellValue: Math.floor(spent * 0.7),
    targetMode: eff.spin ? null : targetMode,
    paths: [mk(0), mk(1)],
  };
}

export interface StorePanelVM {
  name: string;
  income: string;
  sellValue: number;
  paths: [UpgradePathVM, UpgradePathVM];
}

export function buildStorePanel(levels: readonly [number, number], gold: number, spent: number): StorePanelVM {
  const inc = effectiveStoreIncome(levels);
  const income =
    `+${inc.tickAmount} / ${inc.tickInterval}s` + (inc.passivePerSec > 0 ? ` · +${inc.passivePerSec}/s` : '');
  const mk = (p: number): UpgradePathVM => {
    const up = nextStoreUpgrade(levels, p);
    const ruleOk = canUpgradePath(levels, p);
    return {
      name: STORE_UPGRADES[p].name,
      level: levels[p],
      next: up ? { name: up.name, cost: up.cost } : null,
      locked: up !== null && !ruleOk,
      canBuy: up !== null && ruleOk && gold >= up.cost,
    };
  };
  return { name: STORE.name, income, sellValue: Math.floor(spent * STORE.sellRefund), paths: [mk(0), mk(1)] };
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
    nextWaveIn: world.nextWaveIn,
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
