import type { MatchEvents, MatchTransport, SendEvent, StatusEvent } from '../../src/net/types';

// Two linked in-memory transports: emits on one fire handlers on the other, synchronously.
export class FakeTransport implements MatchTransport {
  peer: FakeTransport | null = null;
  nickname = '';
  joined = false;
  private handlers: Partial<MatchEvents> = {};

  async join(myNickname: string): Promise<void> {
    this.nickname = myNickname;
    this.joined = true;
    if (this.peer?.joined) {
      this.handlers.peerJoin?.(this.peer.nickname);
      this.peer.fire('peerJoin', this.nickname);
    }
  }

  on<K extends keyof MatchEvents>(event: K, cb: MatchEvents[K]): void {
    this.handlers[event] = cb;
  }

  emit(type: 'send', payload: SendEvent): void;
  emit(type: 'status', payload: StatusEvent): void;
  emit(type: 'defeat' | 'ready' | 'rematch'): void;
  emit(type: keyof MatchEvents, payload?: unknown): void {
    this.peer?.fire(type, payload);
  }

  fire(type: keyof MatchEvents, payload?: unknown): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.handlers[type] as any)?.(payload);
  }

  leave(): void {
    this.joined = false;
    this.peer?.fire('peerLeave');
  }
}

export function transportPair(): [FakeTransport, FakeTransport] {
  const a = new FakeTransport();
  const b = new FakeTransport();
  a.peer = b;
  b.peer = a;
  return [a, b];
}
