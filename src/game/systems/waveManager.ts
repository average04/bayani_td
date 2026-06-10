import type { WaveConfig } from '../config/waves';

interface PendingSpawn {
  id: string;
  delay: number; // seconds to wait before emitting this spawn
}

export class WaveManager {
  private readonly waves: WaveConfig[];
  private readonly generate?: (waveNumber: number) => WaveConfig; // endless mode when provided
  currentWaveIndex: number; // -1 before any wave starts
  private pending: PendingSpawn[];
  private timer: number;

  constructor(waves: WaveConfig[], generate?: (waveNumber: number) => WaveConfig) {
    this.waves = waves;
    this.generate = generate;
    this.currentWaveIndex = -1;
    this.pending = [];
    this.timer = 0;
  }

  get totalWaves(): number {
    return this.generate ? Infinity : this.waves.length;
  }

  get currentWaveNumber(): number {
    return this.currentWaveIndex + 1; // 1-based; 0 before start
  }

  get isSpawning(): boolean {
    return this.pending.length > 0;
  }

  get hasMoreWaves(): boolean {
    return this.generate ? true : this.currentWaveIndex < this.waves.length - 1;
  }

  get isComplete(): boolean {
    if (this.generate) return false; // endless: the run never "completes"
    return this.currentWaveIndex === this.waves.length - 1 && this.pending.length === 0;
  }

  canStartNextWave(): boolean {
    return this.hasMoreWaves && !this.isSpawning;
  }

  /** Seconds the given (1-based) wave spends spawning; groups spawn sequentially. */
  spawnDuration(waveNumber: number): number {
    const w = this.waveAt(waveNumber - 1);
    return w.spawns.reduce((s, sp) => s + sp.count * sp.interval, 0);
  }

  private waveAt(index: number): WaveConfig {
    if (index < this.waves.length) return this.waves[index];
    return this.generate!(index + 1); // generator takes a 1-based wave number
  }

  startNextWave(): void {
    if (!this.canStartNextWave()) return;
    this.currentWaveIndex++;
    const wave = this.waveAt(this.currentWaveIndex);
    this.pending = [];
    for (const spawn of wave.spawns) {
      for (let i = 0; i < spawn.count; i++) {
        this.pending.push({ id: spawn.enemyTypeId, delay: spawn.interval });
      }
    }
    this.timer = this.pending.length > 0 ? this.pending[0].delay : 0;
  }

  update(dt: number): string[] {
    const spawned: string[] = [];
    if (this.pending.length === 0) return spawned;
    this.timer -= dt;
    while (this.pending.length > 0 && this.timer <= 0) {
      const next = this.pending.shift()!;
      spawned.push(next.id);
      this.timer += this.pending.length > 0 ? this.pending[0].delay : 0;
    }
    return spawned;
  }
}
