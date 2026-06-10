import { describe, it, expect } from 'vitest';
import { transportPair } from './fakeTransport';
import type { SendEvent } from '../../src/net/types';

describe('FakeTransport pair', () => {
  it('routes events to the peer, not back to the sender', async () => {
    const [a, b] = transportPair();
    const got: SendEvent[] = [];
    const echoed: SendEvent[] = [];
    b.on('send', (e) => got.push(e));
    a.on('send', (e) => echoed.push(e));
    await a.join('Ana');
    await b.join('Ben');
    a.emit('send', { enemyTypeId: 'tiyanak', count: 3 });
    expect(got).toEqual([{ enemyTypeId: 'tiyanak', count: 3 }]);
    expect(echoed).toEqual([]);
  });

  it('signals peerJoin with the nickname and peerLeave on leave', async () => {
    const [a, b] = transportPair();
    const joins: string[] = [];
    let left = 0;
    a.on('peerJoin', (n) => joins.push(n));
    a.on('peerLeave', () => left++);
    await a.join('Ana');
    await b.join('Ben');
    expect(joins).toEqual(['Ben']);
    b.leave();
    expect(left).toBe(1);
  });
});
