import { describe, it, expect } from 'vitest';
import { World } from '../../src/game/world';
import { LEVEL_ONE } from '../../src/game/config/levels';
import { ENEMY_TYPES } from '../../src/game/config/enemies';
import { HERO_TYPES } from '../../src/game/config/heroes';
import { WAVES, generateWave } from '../../src/game/config/waves';
import { gridCols, gridRows, footprintCenter } from '../../src/game/grid';
import { distance } from '../../src/game/geometry';

// Headless balance sim: a scripted "decent player" runs the real endless game.
// Guards the difficulty curve: a solid build must survive the early waves but the
// endless ramp must eventually win. Tune waves/HP/bounties against these bounds.

interface Spot {
  col: number;
  row: number;
  coverage: number;
}

// rank build spots by how much path a tower there can cover (range ~130)
function rankedSpots(w: World): Spot[] {
  const samples: { x: number; y: number }[] = [];
  const path = LEVEL_ONE.path;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const len = distance(a, b);
    for (let d = 0; d <= len; d += 12) {
      samples.push({ x: a.x + ((b.x - a.x) * d) / len, y: a.y + ((b.y - a.y) * d) / len });
    }
  }
  const spots: Spot[] = [];
  for (let row = 0; row < gridRows(LEVEL_ONE) - 1; row++) {
    for (let col = 0; col < gridCols(LEVEL_ONE) - 1; col++) {
      if (!w.canPlaceAt(col, row)) continue;
      const c = footprintCenter(LEVEL_ONE, col, row);
      const coverage = samples.filter((s) => distance(s, c) <= 120).length;
      if (coverage > 0) spots.push({ col, row, coverage });
    }
  }
  return spots.sort((a, b) => b.coverage - a.coverage);
}

interface SimResult {
  waveReached: number;
  livesLeft: number;
  log: string[];
}

// drives the world with a simple greedy policy: build up to 9 towers in coverage order,
// then keep buying the cheapest affordable upgrade (avoiding random root paths for determinism)
function simulate(buildOrder: string[], maxWave: number): SimResult {
  const w = new World({
    level: LEVEL_ONE,
    enemyTypes: ENEMY_TYPES,
    heroTypes: HERO_TYPES,
    waves: WAVES,
    generateWave,
  });
  const log: string[] = [];
  let nextBuild = 0;
  let lastWave = 0;
  const dt = 0.05;
  // up to 30 simulated minutes; bail when lost or maxWave cleared
  for (let t = 0; t < 30 * 60 && w.status === 'playing'; t += dt) {
    // build the next tower of the scripted order when affordable
    if (nextBuild < buildOrder.length) {
      const heroId = buildOrder[nextBuild];
      if (w.gold >= HERO_TYPES[heroId].cost + 20) {
        const spot = rankedSpots(w)[0];
        if (spot && w.placeTower(heroId, spot.col, spot.row)) nextBuild++;
      }
    } else {
      // then upgrade: cheapest available next level across all towers (skip diwata path 1 = random roots)
      let best: { tower: (typeof w.towers)[number]; path: number; cost: number } | null = null;
      for (const tower of w.towers) {
        for (let p = 0; p < 2; p++) {
          if (tower.type.id === 'diwata' && p === 1) continue;
          if (!w.canUpgrade(tower, p)) continue;
          const cost = w.nextUpgradeCost(tower, p)!;
          if (!best || cost < best.cost) best = { tower, path: p, cost };
        }
      }
      if (best && w.gold >= best.cost) w.upgradeTower(best.tower, best.path);
    }
    w.update(dt);
    if (w.waveNumber !== lastWave) {
      lastWave = w.waveNumber;
      log.push(`wave ${lastWave}: lives=${w.lives} gold=${w.gold} towers=${w.towers.length}`);
      if (lastWave > maxWave) break;
    }
  }
  return { waveReached: w.waveNumber, livesLeft: w.lives, log };
}

describe('endless balance simulation', () => {
  it('a solid 4-card build survives the first boss but endless eventually wins', () => {
    const result = simulate(
      // greedy DPS quad: shooter, splash, slow, sniper, then reinforcements
      ['gabriela', 'bernardo', 'diwata', 'apolaki', 'gabriela', 'apolaki', 'bernardo', 'gabriela', 'apolaki'],
      60,
    );
    // eslint-disable-next-line no-console
    console.log(result.log.join('\n'));
    // eslint-disable-next-line no-console
    console.log(`>> reached wave ${result.waveReached} with ${result.livesLeft} lives left`);
    expect(result.waveReached).toBeGreaterThanOrEqual(12); // early game beatable incl. wave-10 boss
    expect(result.waveReached).toBeLessThanOrEqual(55); // the endless ramp must actually end runs
  }, 120_000);
});
