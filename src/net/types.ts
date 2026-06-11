export interface SendEvent {
  enemyTypeId: string;
  count: number;
}

// compact rival-board snapshot, piggybacked on the status ping (drives the mini-view)
export interface TowerSnap {
  heroId: string;
  x: number;
  y: number;
}

export interface EnemySnap {
  id: number; // Enemy.seq — stable across snapshots so the view can interpolate
  typeId: string;
  x: number;
  y: number;
  hp: number; // 0..1 fraction
}

// attack/death moments batched since the last ping, replayed on the rival's view
export interface ShotSnap {
  heroId: string;
  fx: number; // from x/y
  fy: number;
  tx: number; // to x/y
  ty: number;
  crit?: boolean;
}

export interface DeathSnap {
  typeId: string;
  x: number;
  y: number;
}

export interface StatusEvent {
  wave: number;
  lives: number;
  gold: number; // intentionally shared in v1 (trusted clients); revisit if sends become rank-based
  towers?: TowerSnap[];
  enemies?: EnemySnap[];
  shots?: ShotSnap[];
  deaths?: DeathSnap[];
}

export interface MatchEvents {
  send: (e: SendEvent) => void;
  status: (e: StatusEvent) => void;
  defeat: () => void;
  ready: () => void;
  rematch: () => void;
  peerJoin: (nickname: string) => void;
  peerLeave: () => void;
}

// One per match. Implemented by MatchChannel (Supabase Realtime) and FakeTransport (tests).
export interface MatchTransport {
  join(myNickname: string): Promise<void>;
  on<K extends keyof MatchEvents>(event: K, cb: MatchEvents[K]): void;
  emit(type: 'send', payload: SendEvent): void;
  emit(type: 'status', payload: StatusEvent): void;
  emit(type: 'defeat' | 'ready' | 'rematch'): void;
  leave(): void;
}
