import type { WaveConfig } from '../config/waves';

interface PendingSpawn {
  id: string;
  delay: number; // seconds to wait before emitting this spawn
}

export class WaveManager {
  private readonly waves: WaveConfig[];
  currentWaveIndex: number; // -1 before any wave starts
  private pending: PendingSpawn[];
  private timer: number;

  constructor(waves: WaveConfig[]) {
    this.waves = waves;
    this.currentWaveIndex = -1;
    this.pending = [];
    this.timer = 0;
  }

  get totalWaves(): number {
    return this.waves.length;
  }

  get currentWaveNumber(): number {
    return this.currentWaveIndex + 1; // 1-based; 0 before start
  }

  get isSpawning(): boolean {
    return this.pending.length > 0;
  }

  get hasMoreWaves(): boolean {
    return this.currentWaveIndex < this.waves.length - 1;
  }

  get isComplete(): boolean {
    return this.currentWaveIndex === this.waves.length - 1 && this.pending.length === 0;
  }

  canStartNextWave(): boolean {
    return this.hasMoreWaves && !this.isSpawning;
  }

  startNextWave(): void {
    if (!this.canStartNextWave()) return;
    this.currentWaveIndex++;
    const wave = this.waves[this.currentWaveIndex];
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
