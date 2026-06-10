import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase } from './supabaseClient';
import type { MatchEvents, MatchTransport, SendEvent, StatusEvent } from './types';

const BROADCASTS = ['send', 'status', 'defeat', 'ready', 'rematch'] as const;

export class MatchChannel implements MatchTransport {
  private channel: RealtimeChannel;
  private handlers: Partial<MatchEvents> = {};
  private readonly myKey = crypto.randomUUID();
  private peerPresent = false;

  constructor(matchId: string) {
    this.channel = getSupabase().channel(`match:${matchId}`, {
      config: { presence: { key: this.myKey }, broadcast: { self: false } },
    });
  }

  async join(myNickname: string): Promise<void> {
    for (const ev of BROADCASTS) {
      this.channel.on('broadcast', { event: ev }, ({ payload }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this.handlers[ev] as any)?.(payload);
      });
    }
    // presence sync covers both "they were already here" and "they just arrived"
    this.channel.on('presence', { event: 'sync' }, () => {
      const state = this.channel.presenceState<{ nickname: string }>();
      const peers = Object.entries(state).filter(([key]) => key !== this.myKey);
      const present = peers.length > 0;
      if (present && !this.peerPresent) {
        this.peerPresent = true;
        this.handlers.peerJoin?.(peers[0][1][0]?.nickname ?? 'Opponent');
      } else if (!present && this.peerPresent) {
        this.peerPresent = false;
        this.handlers.peerLeave?.();
      }
    });
    await new Promise<void>((resolve, reject) => {
      this.channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await this.channel.track({ nickname: myNickname });
          resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          reject(new Error(`realtime channel: ${status}`));
        }
      });
    });
  }

  on<K extends keyof MatchEvents>(event: K, cb: MatchEvents[K]): void {
    this.handlers[event] = cb;
  }

  emit(type: 'send', payload: SendEvent): void;
  emit(type: 'status', payload: StatusEvent): void;
  emit(type: 'defeat' | 'ready' | 'rematch'): void;
  emit(type: keyof MatchEvents, payload?: unknown): void {
    void this.channel.send({ type: 'broadcast', event: type, payload });
  }

  leave(): void {
    void getSupabase().removeChannel(this.channel);
  }
}
