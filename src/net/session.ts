import type { MatchTransport } from './types';

// The active multiplayer match, set by the lobby before the Phaser game boots.
// Solo play leaves this null — GameScene checks it to enable MP behavior.
export interface MatchSession {
  matchId: string;
  myId: string;
  opponentId: string;
  isHost: boolean;
  myNickname: string;
  opponentNickname: string;
  transport: MatchTransport;
}

let current: MatchSession | null = null;

export function setSession(s: MatchSession | null): void {
  current = s;
}

export function getSession(): MatchSession | null {
  return current;
}
