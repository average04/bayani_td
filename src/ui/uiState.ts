import type { HeroType } from '../game/config/heroes';
import type { GameStatus } from '../game/state/gameState';
import { UPGRADES, nextUpgrade, canUpgradePath, effectiveStats, type TowerStats } from '../game/config/upgrades';
import { HERO_TYPES } from '../game/config/heroes';
import { STORE, STORE_UPGRADES, nextStoreUpgrade, effectiveStoreIncome } from '../game/config/store';
import type { TargetMode } from '../game/entities/tower';
import { SEND_TABLE } from '../game/config/sends';
import { ENEMY_TYPES } from '../game/config/enemies';

export interface WorldLike {
  lives: number;
  gold: number;
  waveNumber: number;
  totalWaves: number;
  status: GameStatus;
  nextWaveIn: number | null;
  passiveIncome: number;
  bossActive: boolean;
  storeMaxed: boolean;
}

export interface HeroVM {
  id: string;
  name: string;
  cost: number;
  affordable: boolean;
  selected: boolean;
}

export interface OpponentVM {
  nickname: string;
  lives: number;
  wave: number;
}

export interface SendVM {
  id: string;
  name: string;
  cost: number;
  unlockWave: number;
  unlocked: boolean;
  affordable: boolean;
}

export interface UiState {
  lives: number;
  gold: number;
  wave: number;
  totalWaves: number;
  status: GameStatus;
  bestWave: number;
  nextWaveIn: number | null;
  passiveIncome: number;
  bossActive: boolean;
  storeMaxed: boolean;
  selectedHeroId: string | null;
  heroes: HeroVM[];
  opponent?: OpponentVM | null;
  sends?: SendVM[];
}

export function canAfford(gold: number, cost: number): boolean {
  return gold >= cost;
}

export interface UpgradePathVM {
  name: string;
  level: number; // 0-4
  next: { name: string; cost: number; desc: string } | null;
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
  const parts: string[] = [];
  if (s.splashRadius) parts.push(`Splash r${s.splashRadius}`);
  if (s.slow) parts.push(`Slow x${s.slow.factor}/${s.slow.duration}s`);
  if (s.poison) parts.push(`Poison ${s.poison.dps}/s`);
  if (s.root) parts.push(`Root ${Math.round(s.root.chance * 100)}%`);
  if (s.aura) parts.push(`Inspire +${Math.round(s.aura.damageAmp * 100)}%`);
  if (s.burnAura) parts.push(`Burn ${s.burnAura.dps}/s r${s.burnAura.radius}`);
  return parts.length ? parts.join(' · ') : 'Single target';
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
      next: up ? { name: up.name, cost: up.cost, desc: up.desc } : null,
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
      next: up ? { name: up.name, cost: up.cost, desc: up.desc } : null,
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
  mp?: { opponent: OpponentVM | null },
): UiState {
  return {
    lives: world.lives,
    gold: world.gold,
    wave: world.waveNumber,
    totalWaves: world.totalWaves,
    status: world.status,
    bestWave,
    nextWaveIn: world.nextWaveIn,
    passiveIncome: world.passiveIncome,
    bossActive: world.bossActive,
    storeMaxed: world.storeMaxed,
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
    opponent: mp ? mp.opponent : undefined,
    sends: mp
      ? SEND_TABLE.map((o) => ({
          id: o.enemyTypeId,
          name: ENEMY_TYPES[o.enemyTypeId]?.name ?? o.enemyTypeId,
          cost: o.cost,
          unlockWave: o.unlockWave,
          unlocked: world.waveNumber >= o.unlockWave,
          affordable: world.gold >= o.cost,
        }))
      : undefined,
  };
}
