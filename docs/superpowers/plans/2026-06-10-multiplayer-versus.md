# Multiplayer v1 — Versus 1v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Real 1v1 multiplayer: each player defends their own board, spends gold to send monsters at the opponent, last base standing wins.

**Architecture:** Each browser runs its own `World` unchanged; one Supabase Realtime channel per match carries tiny events (`send`, `status`, `defeat`, `ready`, `rematch`) plus presence for join/leave. Postgres (`profiles`, `matches`) handles identity, room codes, the quick-match queue, and results. Clients are trusted (v1).

**Tech Stack:** Phaser 3 + TypeScript + Vite (existing), Vitest, `@supabase/supabase-js`, Supabase project `rmltqxuvlqzngtdcadwx` (anonymous auth, Postgres + RLS, Realtime broadcast/presence).

**Spec:** `docs/superpowers/specs/2026-06-10-multiplayer-versus-design.md`

**Executor notes:**
- Invoke the `supabase:supabase` skill before Tasks 1–2 (Supabase work).
- Run all commands from the repo root `d:/Projects/bayani-td`.
- `npm test` = `vitest run`. Type-check with `npx tsc --noEmit`.
- Git workflow: commit directly to `main` (project convention).

---

### Task 1: Supabase backend — schema, RLS, anonymous auth

**Files:** none in repo (remote migration via Supabase MCP)

- [ ] **Step 1: Apply the migration**

Use MCP tool `apply_migration` on project `rmltqxuvlqzngtdcadwx`, name `multiplayer_v1`:

```sql
-- identity: nickname per anonymous user
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 2 and 20),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles_select_all" on public.profiles for select using (true);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = user_id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = user_id);

-- rooms + queue + results in one table.
-- status flow: room = waiting -> active -> done; quick-match queue rows are status='searching'
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  status text not null check (status in ('searching','waiting','active','done')),
  host_id uuid not null references auth.users(id) on delete cascade,
  guest_id uuid references auth.users(id) on delete set null,
  winner_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
alter table public.matches enable row level security;
create index matches_searching_idx on public.matches (created_at) where status = 'searching';

create policy "matches_select_open_or_mine" on public.matches for select
  using (status in ('searching','waiting') or auth.uid() in (host_id, guest_id));
create policy "matches_insert_as_host" on public.matches for insert
  with check (auth.uid() = host_id and guest_id is null and status in ('searching','waiting'));
-- a non-participant may update ONLY an unclaimed open row (that's the atomic join/claim);
-- the with-check forces them to end up as a participant
create policy "matches_update_join_or_mine" on public.matches for update
  using (auth.uid() in (host_id, guest_id) or (guest_id is null and status in ('searching','waiting')))
  with check (auth.uid() in (host_id, guest_id));
create policy "matches_delete_own_open" on public.matches for delete
  using (auth.uid() = host_id and status in ('searching','waiting'));
```

- [ ] **Step 2: Verify tables + advisors**

MCP `list_tables` → expect `profiles`, `matches` in `public`. MCP `get_advisors` (security) → no errors about these tables (RLS is enabled on both).

- [ ] **Step 3: Verify anonymous sign-in is enabled**

Anonymous auth is a dashboard toggle the MCP cannot set. Tell the user: Supabase Dashboard → project `rmltqxuvlqzngtdcadwx` → Authentication → Sign In / Up → enable **Anonymous sign-ins** (if not already on). The Task 10 smoke test will fail with "Anonymous sign-ins are disabled" if skipped.

---

### Task 2: Client plumbing — dependency, env, supabase client

**Files:**
- Create: `src/vite-env.d.ts`, `src/net/supabaseClient.ts`, `.env.local` (NOT committed), `.env.example`
- Modify: `.gitignore`, `package.json` (via npm)

- [ ] **Step 1: Install the SDK**

Run: `npm install @supabase/supabase-js`
Expected: added to `dependencies`, install succeeds.

- [ ] **Step 2: Env files**

Fetch values with MCP `get_project_url` and `get_publishable_keys` (use the publishable/anon key). Create `.env.local`:

```
VITE_SUPABASE_URL=https://rmltqxuvlqzngtdcadwx.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable key from MCP>
```

Create `.env.example` (committed):

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Ensure `.gitignore` ignores local env (append if absent):

```
.env.local
```

- [ ] **Step 3: Vite env types**

Create `src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />
```

- [ ] **Step 4: Client module**

Create `src/net/supabaseClient.ts`:

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// false when env vars are missing — the lobby shows a friendly message instead of crashing
export const supabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!client) {
    if (!supabaseConfigured) throw new Error('Supabase is not configured (.env.local)');
    client = createClient(url!, anonKey!);
  }
  return client;
}
```

- [ ] **Step 5: Type-check and commit**

Run: `npx tsc --noEmit` → clean.

```bash
git add .gitignore .env.example src/vite-env.d.ts src/net/supabaseClient.ts package.json package-lock.json
git commit -m "feat(mp): supabase client plumbing + env wiring"
```

---

### Task 3: Transport interface + FakeTransport + tests

**Files:**
- Create: `src/net/types.ts`, `tests/net/fakeTransport.ts`, `tests/net/transport.test.ts`

- [ ] **Step 1: Define the transport interface**

Create `src/net/types.ts`:

```ts
export interface SendEvent {
  enemyTypeId: string;
  count: number;
}

export interface StatusEvent {
  wave: number;
  lives: number;
  gold: number;
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
```

- [ ] **Step 2: Write the failing tests**

Create `tests/net/fakeTransport.ts`:

```ts
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
```

Create `tests/net/transport.test.ts`:

```ts
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
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/net/transport.test.ts`
Expected: PASS (2 tests). (The fake is the implementation under test; the interface file makes `tsc` the other gate.)

- [ ] **Step 4: Type-check and commit**

Run: `npx tsc --noEmit` → clean.

```bash
git add src/net/types.ts tests/net/fakeTransport.ts tests/net/transport.test.ts
git commit -m "feat(mp): match transport interface + in-memory fake with tests"
```

---

### Task 4: matchService — auth, nickname, rooms, queue, results

**Files:**
- Create: `src/net/matchService.ts`, `tests/net/matchService.test.ts`

- [ ] **Step 1: Write the failing test (pure parts)**

Create `tests/net/matchService.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { generateCode, normalizeCode } from '../../src/net/matchService';

describe('room codes', () => {
  it('generates codes like BAYAN-1234', () => {
    for (let i = 0; i < 20; i++) {
      expect(generateCode()).toMatch(/^BAYAN-\d{4}$/);
    }
  });

  it('normalizes user input (trim, uppercase, allows missing prefix)', () => {
    expect(normalizeCode('  bayan-0042 ')).toBe('BAYAN-0042');
    expect(normalizeCode('0042')).toBe('BAYAN-0042');
  });
});
```

Run: `npx vitest run tests/net/matchService.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 2: Implement the service**

Create `src/net/matchService.ts`:

```ts
import { getSupabase } from './supabaseClient';

export interface MatchRow {
  id: string;
  code: string;
  host_id: string;
  guest_id: string | null;
}

export function generateCode(): string {
  return `BAYAN-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
}

export function normalizeCode(input: string): string {
  const v = input.trim().toUpperCase();
  return v.startsWith('BAYAN-') ? v : `BAYAN-${v}`;
}

/** Anonymous session: reuse if present, otherwise sign in anonymously. Returns user id. */
export async function ensureSession(): Promise<string> {
  const sb = getSupabase();
  const { data } = await sb.auth.getSession();
  if (data.session) return data.session.user.id;
  const { data: anon, error } = await sb.auth.signInAnonymously();
  if (error || !anon.user) throw error ?? new Error('anonymous sign-in failed');
  return anon.user.id;
}

export async function getNickname(userId: string): Promise<string | null> {
  const { data } = await getSupabase()
    .from('profiles')
    .select('nickname')
    .eq('user_id', userId)
    .maybeSingle();
  return data?.nickname ?? null;
}

export async function saveNickname(userId: string, nickname: string): Promise<void> {
  const { error } = await getSupabase().from('profiles').upsert({ user_id: userId, nickname });
  if (error) throw error;
}

/** Create a private room (status 'waiting'); retries on the rare code collision. */
export async function createRoom(userId: string): Promise<MatchRow> {
  const sb = getSupabase();
  for (let i = 0; i < 5; i++) {
    const code = generateCode();
    const { data, error } = await sb
      .from('matches')
      .insert({ code, status: 'waiting', host_id: userId })
      .select('id, code, host_id, guest_id')
      .single();
    if (data) return data;
    if (error && error.code !== '23505') throw error; // 23505 = unique_violation -> retry
  }
  throw new Error('could not allocate a room code');
}

/** Join a room by code. Atomic claim: the conditional update wins or returns null. */
export async function joinRoom(userId: string, codeInput: string): Promise<MatchRow | null> {
  const sb = getSupabase();
  const code = normalizeCode(codeInput);
  const { data: row } = await sb
    .from('matches')
    .select('id, code, host_id, guest_id')
    .eq('code', code)
    .eq('status', 'waiting')
    .is('guest_id', null)
    .maybeSingle();
  if (!row) return null;
  const { data: claimed } = await sb
    .from('matches')
    .update({ guest_id: userId, status: 'active' })
    .eq('id', row.id)
    .is('guest_id', null)
    .select('id, code, host_id, guest_id');
  return claimed && claimed.length > 0 ? claimed[0] : null;
}

/** Quick match: claim the oldest 'searching' row, else enqueue ourselves as one. */
export async function quickMatch(
  userId: string,
): Promise<{ match: MatchRow; isHost: boolean }> {
  const sb = getSupabase();
  for (let i = 0; i < 3; i++) {
    const { data: open } = await sb
      .from('matches')
      .select('id, code, host_id, guest_id')
      .eq('status', 'searching')
      .neq('host_id', userId)
      .is('guest_id', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!open) break;
    const { data: claimed } = await sb
      .from('matches')
      .update({ guest_id: userId, status: 'active' })
      .eq('id', open.id)
      .is('guest_id', null)
      .select('id, code, host_id, guest_id');
    if (claimed && claimed.length > 0) return { match: claimed[0], isHost: false };
    // someone else claimed it between select and update — try the next row
  }
  const { data, error } = await sb
    .from('matches')
    .insert({ code: generateCode(), status: 'searching', host_id: userId })
    .select('id, code, host_id, guest_id')
    .single();
  if (error || !data) throw error ?? new Error('failed to join the queue');
  return { match: data, isHost: true };
}

/** Host marks their own waiting/searching room active once presence shows the guest arrived. */
export async function markActive(matchId: string): Promise<void> {
  await getSupabase().from('matches').update({ status: 'active' }).eq('id', matchId);
}

/** Cancel an open room/queue entry (host only — RLS enforces). */
export async function cancelMatch(matchId: string): Promise<void> {
  await getSupabase().from('matches').delete().eq('id', matchId);
}

/** The winner records the result (loser does nothing). */
export async function finishMatch(matchId: string, winnerId: string): Promise<void> {
  await getSupabase()
    .from('matches')
    .update({ status: 'done', winner_id: winnerId, finished_at: new Date().toISOString() })
    .eq('id', matchId);
}

export async function fetchNicknameOf(userId: string): Promise<string> {
  return (await getNickname(userId)) ?? 'Opponent';
}
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/net/matchService.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 4: Type-check and commit**

Run: `npx tsc --noEmit` → clean.

```bash
git add src/net/matchService.ts tests/net/matchService.test.ts
git commit -m "feat(mp): match service — anonymous auth, rooms, quick-match queue, results"
```

---

### Task 5: MatchChannel — the Supabase Realtime transport

**Files:**
- Create: `src/net/matchChannel.ts`

(No unit test — this is thin glue over `supabase-js`; it's exercised by the Task 10 smoke test. All game-side logic is tested through `FakeTransport`.)

- [ ] **Step 1: Implement**

Create `src/net/matchChannel.ts`:

```ts
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
```

Note: channels are public in v1; the match-id channel name is an unguessable uuid (spec accepts trusted clients).

- [ ] **Step 2: Type-check and commit**

Run: `npx tsc --noEmit` → clean.

```bash
git add src/net/matchChannel.ts
git commit -m "feat(mp): supabase realtime transport (broadcast + presence)"
```

---

### Task 6: World — incoming sends

**Files:**
- Modify: `src/game/entities/enemy.ts` (add `sent` flag), `src/game/world.ts`
- Test: `tests/game/world-sends.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/game/world-sends.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { World } from '../../src/game/world';
import type { WorldConfig } from '../../src/game/world';
import type { LevelConfig } from '../../src/game/config/levels';
import type { EnemyType } from '../../src/game/config/enemies';
import { scaledMaxHp } from '../../src/game/config/enemies';

const level: LevelConfig = {
  id: 't', name: 'T', tileSize: 48, cols: 16, rows: 10, cellSize: 24,
  path: [{ x: 0, y: 0 }, { x: 700, y: 0 }],
  startingGold: 1000, startingLives: 20,
};
const grunt: EnemyType = { id: 'grunt', name: 'G', maxHp: 50, speed: 0, reward: 2, leakDamage: 1 };

function makeWorld(): World {
  const cfg: WorldConfig = {
    level,
    enemyTypes: { grunt },
    heroTypes: {},
    waves: [{ spawns: [] }],
    generateWave: () => ({ spawns: [] }),
  };
  return new World(cfg);
}

describe('incoming sends', () => {
  it('spawns sent enemies staggered at the path entrance, flagged as sent', () => {
    const w = makeWorld();
    w.queueIncomingSend('grunt', 2);
    w.update(0.5); // first arrives (0.4s), second still pending (0.8s)
    expect(w.enemies).toHaveLength(1);
    w.update(0.4);
    expect(w.enemies).toHaveLength(2);
    expect(w.enemies.every((e) => e.sent)).toBe(true);
    expect(w.enemies[0].pos.x).toBeCloseTo(0, 0); // entered at path[0]
  });

  it('scales sent-enemy HP by the receiver wave (min wave 1)', () => {
    const w = makeWorld();
    w.queueIncomingSend('grunt', 1);
    w.update(0.5);
    expect(w.enemies[0].maxHp).toBe(scaledMaxHp(grunt.maxHp, 1)); // wave 0 clamps to 1
  });

  it('ignores unknown enemy ids', () => {
    const w = makeWorld();
    w.queueIncomingSend('nope', 3);
    w.update(1);
    expect(w.enemies).toHaveLength(0);
  });
});
```

Run: `npx vitest run tests/game/world-sends.test.ts`
Expected: FAIL — `queueIncomingSend` does not exist.

- [ ] **Step 2: Implement**

In `src/game/entities/enemy.ts`, add a public field next to `contagion`:

```ts
  sent = false; // arrived via an opponent's send (multiplayer) — gets a visual marker
```

In `src/game/world.ts`:

Add to the class fields (next to `pendingEchoes`):

```ts
  private incomingSends: { enemyTypeId: string; timer: number }[] = [];
```

Add this public method (near `startNextWave`):

```ts
  /** Multiplayer: opponent sent extra monsters. They enter staggered, scaled to OUR wave. */
  queueIncomingSend(enemyTypeId: string, count: number): void {
    if (!this.enemyTypes[enemyTypeId]) return;
    for (let i = 0; i < count; i++) {
      this.incomingSends.push({ enemyTypeId, timer: 0.4 * (i + 1) });
    }
  }
```

In `update()`, right after the wave-manager spawn loop (step 1), add:

```ts
    // 1.5 sent monsters arrive (multiplayer)
    if (this.incomingSends.length > 0) {
      const still: { enemyTypeId: string; timer: number }[] = [];
      for (const s of this.incomingSends) {
        s.timer -= dt;
        if (s.timer > 0) {
          still.push(s);
          continue;
        }
        const type = this.enemyTypes[s.enemyTypeId];
        const e = new Enemy(type, this.level.path, scaledMaxHp(type.maxHp, Math.max(1, this.waveNumber)));
        e.sent = true;
        this.enemies.push(e);
      }
      this.incomingSends = still;
    }
```

(`scaledMaxHp` and `Enemy` are already imported in `world.ts`.)

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/game/world-sends.test.ts` → PASS (3 tests).
Run: `npx vitest run` → all suites PASS (sent enemies sitting on the field correctly delay the wave-clear bonus; no existing test feeds sends, so nothing else changes).

- [ ] **Step 4: Commit**

```bash
git add src/game/entities/enemy.ts src/game/world.ts tests/game/world-sends.test.ts
git commit -m "feat(mp): worlds accept incoming sends (staggered, wave-scaled, flagged)"
```

---

### Task 7: Send table + purchase validation

**Files:**
- Create: `src/game/config/sends.ts`
- Modify: `src/game/world.ts`
- Test: `tests/game/sends.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/game/sends.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { SEND_TABLE, canSend } from '../../src/game/config/sends';
import { ENEMY_TYPES } from '../../src/game/config/enemies';
import { World } from '../../src/game/world';
import type { LevelConfig } from '../../src/game/config/levels';

const level: LevelConfig = {
  id: 't', name: 'T', tileSize: 48, cols: 16, rows: 10, cellSize: 24,
  path: [{ x: 0, y: 0 }, { x: 700, y: 0 }],
  startingGold: 100, startingLives: 20,
};

describe('send table', () => {
  it('every entry references a real enemy type', () => {
    for (const o of SEND_TABLE) expect(ENEMY_TYPES[o.enemyTypeId], o.enemyTypeId).toBeDefined();
  });

  it('canSend gates on gold AND unlock wave', () => {
    const tiyanak = SEND_TABLE[0]; // cost 25, unlock 1
    const kapre = SEND_TABLE.find((o) => o.enemyTypeId === 'kapre')!; // unlock 9
    expect(canSend(tiyanak, 100, 1)).toBe(true);
    expect(canSend(tiyanak, 10, 1)).toBe(false); // poor
    expect(canSend(kapre, 1000, 5)).toBe(false); // locked
    expect(canSend(kapre, 1000, 9)).toBe(true);
  });
});

describe('World.buySend', () => {
  it('debits gold on success and refuses when locked or poor', () => {
    const w = new World({ level, enemyTypes: ENEMY_TYPES, heroTypes: {}, waves: [{ spawns: [] }] });
    const tiyanak = SEND_TABLE[0];
    w.startNextWave(); // wave 1
    expect(w.buySend(tiyanak)).toBe(true);
    expect(w.gold).toBe(75);
    const bakunawa = SEND_TABLE.find((o) => o.enemyTypeId === 'bakunawa')!; // unlock 15
    expect(w.buySend(bakunawa)).toBe(false); // locked at wave 1
    expect(w.gold).toBe(75);
  });
});
```

Run: `npx vitest run tests/game/sends.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 2: Implement**

Create `src/game/config/sends.ts`:

```ts
// Multiplayer send menu: spend gold to throw monsters at the opponent.
// unlockWave gates on the SENDER's current wave (spec). Costs are a first balance pass.
export interface SendOption {
  enemyTypeId: string;
  cost: number;
  unlockWave: number;
}

export const SEND_TABLE: SendOption[] = [
  { enemyTypeId: 'tiyanak', cost: 25, unlockWave: 1 },
  { enemyTypeId: 'tiktik', cost: 35, unlockWave: 2 },
  { enemyTypeId: 'aswang', cost: 50, unlockWave: 4 },
  { enemyTypeId: 'manananggal', cost: 90, unlockWave: 7 },
  { enemyTypeId: 'kapre', cost: 120, unlockWave: 9 },
  { enemyTypeId: 'bakunawa', cost: 500, unlockWave: 15 },
];

export function canSend(o: SendOption, gold: number, wave: number): boolean {
  return gold >= o.cost && wave >= o.unlockWave;
}
```

In `src/game/world.ts`, import the type and add the method (near `queueIncomingSend`):

```ts
import { canSend, type SendOption } from './config/sends';
```

```ts
  /** Multiplayer: validate + pay for an outgoing send. The caller emits the network event. */
  buySend(option: SendOption): boolean {
    if (!canSend(option, this.gold, this.waveNumber)) return false;
    return this.economy.spend(option.cost);
  }
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/game/sends.test.ts` → PASS (3 tests).
Run: `npx tsc --noEmit` → clean.

- [ ] **Step 4: Commit**

```bash
git add src/game/config/sends.ts src/game/world.ts tests/game/sends.test.ts
git commit -m "feat(mp): send table with wave unlocks + gold-debiting buySend"
```

---

### Task 8: Session module + lobby UI + home wiring

**Files:**
- Create: `src/net/session.ts`, `src/ui/lobby.ts`
- Modify: `src/ui/homeScreen.ts`, `src/ui/ui.css`

- [ ] **Step 1: Session module**

Create `src/net/session.ts`:

```ts
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
```

- [ ] **Step 2: Lobby UI**

Create `src/ui/lobby.ts`:

```ts
import { supabaseConfigured } from '../net/supabaseClient';
import {
  ensureSession, getNickname, saveNickname, createRoom, joinRoom, quickMatch,
  cancelMatch, markActive, fetchNicknameOf, type MatchRow,
} from '../net/matchService';
import { MatchChannel } from '../net/matchChannel';
import type { MatchSession } from '../net/session';

export interface LobbyCallbacks {
  onMatched: (session: MatchSession) => void;
  onBack: () => void;
}

function el(html: string): HTMLElement {
  const d = document.createElement('div');
  d.innerHTML = html.trim();
  return d.firstElementChild as HTMLElement;
}

// Full-screen multiplayer lobby: nickname -> menu -> (room code | join | quick match) -> matched.
export function showLobby(cb: LobbyCallbacks): void {
  const root = el(`<div class="ui-lobby"><div class="ui-lobby-inner"></div></div>`);
  const inner = root.querySelector<HTMLElement>('.ui-lobby-inner')!;
  document.body.appendChild(root);
  let leaving = false;

  const swap = (node: HTMLElement): void => {
    inner.innerHTML = '';
    inner.appendChild(node);
  };

  const fail = (msg: string, retry: () => void): void => {
    const v = el(`<div class="ui-lobby-box">
      <p class="ui-lobby-err">${msg}</p>
      <button class="ui-lobby-btn" data-a="retry">TRY AGAIN</button>
      <button class="ui-lobby-btn ghost" data-a="back">BACK</button>
    </div>`);
    v.querySelector('[data-a="retry"]')!.addEventListener('click', retry);
    v.querySelector('[data-a="back"]')!.addEventListener('click', () => {
      root.remove();
      cb.onBack();
    });
    swap(v);
  };

  if (!supabaseConfigured) {
    fail('Multiplayer needs Supabase configured — copy .env.example to .env.local and fill it in.', () => location.reload());
    return;
  }

  void boot();

  async function boot(): Promise<void> {
    swap(el(`<p class="ui-lobby-note">Connecting…</p>`));
    try {
      const myId = await ensureSession();
      const nick = await getNickname(myId);
      if (nick) menu(myId, nick);
      else nicknameForm(myId);
    } catch (e) {
      fail(`Could not connect: ${(e as Error).message}`, () => void boot());
    }
  }

  function nicknameForm(myId: string): void {
    const v = el(`<div class="ui-lobby-box">
      <h2>Pick a battle name</h2>
      <input class="ui-lobby-input" maxlength="20" placeholder="2-20 characters" />
      <button class="ui-lobby-btn" disabled>SAVE</button>
    </div>`);
    const input = v.querySelector<HTMLInputElement>('input')!;
    const btn = v.querySelector<HTMLButtonElement>('button')!;
    input.addEventListener('input', () => {
      btn.disabled = input.value.trim().length < 2;
    });
    btn.addEventListener('click', () => {
      void saveNickname(myId, input.value.trim())
        .then(() => menu(myId, input.value.trim()))
        .catch((e) => fail(`Could not save name: ${(e as Error).message}`, () => nicknameForm(myId)));
    });
    swap(v);
    input.focus();
  }

  function menu(myId: string, myNickname: string): void {
    const v = el(`<div class="ui-lobby-box">
      <h2>Multiplayer — Versus</h2>
      <p class="ui-lobby-note">Playing as <b>${myNickname}</b></p>
      <button class="ui-lobby-btn" data-a="create">CREATE ROOM</button>
      <div class="ui-lobby-joinrow">
        <input class="ui-lobby-input" maxlength="10" placeholder="BAYAN-0000" />
        <button class="ui-lobby-btn" data-a="join">JOIN</button>
      </div>
      <button class="ui-lobby-btn" data-a="quick">QUICK MATCH</button>
      <button class="ui-lobby-btn ghost" data-a="back">BACK</button>
    </div>`);
    const codeInput = v.querySelector<HTMLInputElement>('input')!;
    v.querySelector('[data-a="create"]')!.addEventListener('click', () => void host(myId, myNickname, 'room'));
    v.querySelector('[data-a="quick"]')!.addEventListener('click', () => void quick(myId, myNickname));
    v.querySelector('[data-a="join"]')!.addEventListener('click', () => void join(myId, myNickname, codeInput.value));
    v.querySelector('[data-a="back"]')!.addEventListener('click', () => {
      root.remove();
      cb.onBack();
    });
    swap(v);
  }

  /** Host path (create room or queue entry), then wait on presence for the guest. */
  async function host(myId: string, myNickname: string, kind: 'room' | 'queue', existing?: MatchRow): Promise<void> {
    try {
      const row = existing ?? (await createRoom(myId));
      const transport = new MatchChannel(row.id);
      const waitMsg = kind === 'room'
        ? `Room code: <b class="ui-lobby-code">${row.code}</b><br/>Waiting for your rival…`
        : 'Searching for a rival…';
      const v = el(`<div class="ui-lobby-box">
        <p class="ui-lobby-note">${waitMsg}</p>
        <button class="ui-lobby-btn ghost">CANCEL</button>
      </div>`);
      v.querySelector('button')!.addEventListener('click', () => {
        leaving = true;
        transport.leave();
        void cancelMatch(row.id);
        menu(myId, myNickname);
      });
      swap(v);
      transport.on('peerJoin', (oppNick) => {
        if (leaving) return;
        void markActive(row.id).then(async () => {
          // guest id lands on the row when they claim it
          const oppId = (await refreshGuestId(row.id)) ?? '';
          done({ matchId: row.id, myId, opponentId: oppId, isHost: true, myNickname, opponentNickname: oppNick, transport });
        });
      });
      await transport.join(myNickname);
    } catch (e) {
      fail(`Could not open a room: ${(e as Error).message}`, () => menu(myId, myNickname));
    }
  }

  async function refreshGuestId(matchId: string): Promise<string | null> {
    const { getSupabase } = await import('../net/supabaseClient');
    const { data } = await getSupabase().from('matches').select('guest_id').eq('id', matchId).maybeSingle();
    return data?.guest_id ?? null;
  }

  /** Guest path: claimed a row, join the channel; host is (or will be) present. */
  async function guest(myId: string, myNickname: string, row: MatchRow): Promise<void> {
    swap(el(`<p class="ui-lobby-note">Joining…</p>`));
    const transport = new MatchChannel(row.id);
    transport.on('peerJoin', (oppNick) => {
      done({ matchId: row.id, myId, opponentId: row.host_id, isHost: false, myNickname, opponentNickname: oppNick, transport });
    });
    try {
      await transport.join(myNickname);
      // fallback if presence raced: fetch the host nickname directly
      setTimeout(() => {
        void fetchNicknameOf(row.host_id).then((n) => {
          done({ matchId: row.id, myId, opponentId: row.host_id, isHost: false, myNickname, opponentNickname: n, transport });
        });
      }, 4000);
    } catch (e) {
      fail(`Could not join: ${(e as Error).message}`, () => menu(myId, myNickname));
    }
  }

  async function join(myId: string, myNickname: string, code: string): Promise<void> {
    if (!code.trim()) return;
    swap(el(`<p class="ui-lobby-note">Looking for the room…</p>`));
    try {
      const row = await joinRoom(myId, code);
      if (!row) {
        fail('No open room with that code.', () => menu(myId, myNickname));
        return;
      }
      await guest(myId, myNickname, row);
    } catch (e) {
      fail(`Join failed: ${(e as Error).message}`, () => menu(myId, myNickname));
    }
  }

  async function quick(myId: string, myNickname: string): Promise<void> {
    swap(el(`<p class="ui-lobby-note">Searching…</p>`));
    try {
      const { match, isHost } = await quickMatch(myId);
      if (isHost) await host(myId, myNickname, 'queue', match);
      else await guest(myId, myNickname, match);
    } catch (e) {
      fail(`Matchmaking failed: ${(e as Error).message}`, () => menu(myId, myNickname));
    }
  }

  let finished = false;
  function done(session: MatchSession): void {
    if (finished) return; // guards the double-fire (presence + fallback timer)
    finished = true;
    root.remove();
    cb.onMatched(session);
  }
}
```

- [ ] **Step 3: Home screen wiring**

In `src/ui/homeScreen.ts`, replace the interface and the multiplayer handler:

```ts
export interface HomeScreenCallbacks {
  onInfinite: () => void;
  onMultiplayer: () => void;
}
```

Replace the `#home-mp` listener block (which currently sets the "coming soon" note) with:

```ts
  home.querySelector<HTMLElement>('#home-mp')!.addEventListener('click', () => {
    home.remove();
    cb.onMultiplayer();
  });
```

In the template, remove the `soon` class from the multiplayer button and update its description:

```html
      <button class="ui-home-mode" id="home-mp">
        <span class="ui-home-mode-name">Multiplayer</span>
        <span class="ui-home-mode-desc">1v1 — send monsters at your rival</span>
      </button>
```

(The unused `note` element/`#home-note` query can stay; it simply never gets text now.)

- [ ] **Step 4: Lobby CSS**

Append to `src/ui/ui.css`:

```css
/* ---- multiplayer lobby ---- */
.ui-lobby {
  position: fixed; inset: 0; z-index: 100; user-select: none; overflow: auto; display: flex;
  font-family: 'Trebuchet MS', system-ui, sans-serif;
  background: radial-gradient(circle at 50% 28%, #2c4030, #0d140e 75%);
  color: #f6e6bd;
}
.ui-lobby-inner { margin: auto; display: flex; flex-direction: column; align-items: center; }
.ui-lobby-box {
  display: flex; flex-direction: column; gap: 12px; align-items: stretch; width: 300px;
  padding: 22px; text-align: center;
  background: linear-gradient(#7d5d34, #5c4324); border: 3px solid #3a2914; border-radius: 12px;
  box-shadow: 0 5px 0 #2c1f0f, inset 0 1px 0 #bd9358;
}
.ui-lobby-box h2 { margin: 0 0 4px; font-size: 22px; color: #f0d999; text-shadow: 0 2px 0 #2c1f0f; }
.ui-lobby-note { margin: 0; color: #e7d3a3; font-size: 14px; line-height: 1.5; }
.ui-lobby-err { margin: 0; color: #ffb09a; font-weight: 700; font-size: 13px; line-height: 1.5; }
.ui-lobby-code { font-size: 22px; letter-spacing: 2px; color: #ffd76a; }
.ui-lobby-btn {
  padding: 10px; cursor: pointer; color: #2c1f0f; font-weight: 800; font-size: 13px; letter-spacing: 1px;
  font-family: inherit;
  background: linear-gradient(#caa24a, #a9802f); border: 2px solid #3a2914; border-radius: 8px;
  box-shadow: 0 3px 0 #5c4012, inset 0 1px 0 #f0d999;
}
.ui-lobby-btn:disabled { filter: grayscale(.6) brightness(.7); cursor: not-allowed; box-shadow: none; }
.ui-lobby-btn.ghost { background: linear-gradient(#5c4a2c, #463720); color: #f6e6bd; }
.ui-lobby-joinrow { display: flex; gap: 8px; }
.ui-lobby-joinrow .ui-lobby-input { flex: 1; min-width: 0; }
.ui-lobby-input {
  padding: 10px; font-family: inherit; font-size: 14px; font-weight: 700; text-align: center;
  color: #2c1f0f; background: #e7d4a4; border: 2px solid #3a2914; border-radius: 8px; outline: none;
}
```

- [ ] **Step 5: Type-check and commit**

Run: `npx tsc --noEmit` → clean. Run: `npx vitest run` → all PASS.

```bash
git add src/net/session.ts src/ui/lobby.ts src/ui/homeScreen.ts src/ui/ui.css
git commit -m "feat(mp): lobby (nickname, rooms, quick match) + home screen wiring"
```

---

### Task 9: In-match UI — opponent strip + send panel

**Files:**
- Modify: `src/ui/uiState.ts`, `src/ui/index.ts`, `src/ui/ui.css`
- Test: extend `tests/ui/uiState.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/ui/uiState.test.ts` (inside the existing `describe('uiState')`):

```ts
  it('includes opponent + send VMs when multiplayer context is given', () => {
    const vm = buildUiState(world, null, 0, order, heroTypes, {
      opponent: { nickname: 'Rival', lives: 12, wave: 4 },
    });
    expect(vm.opponent).toEqual({ nickname: 'Rival', lives: 12, wave: 4 });
    expect(vm.sends!.length).toBeGreaterThan(0);
    const tiyanak = vm.sends!.find((s) => s.id === 'tiyanak')!;
    expect(tiyanak).toMatchObject({ cost: 25, unlocked: false }); // world.waveNumber 2 vs... see below
  });
```

Note: the fixture `world` has `waveNumber: 2` and `gold: 75`, so expect: `tiyanak` (unlock 1) → `unlocked: true, affordable: true`; `kapre` (unlock 9) → `unlocked: false`. Write the assertions accordingly:

```ts
    const kapre = vm.sends!.find((s) => s.id === 'kapre')!;
    expect(tiyanak).toMatchObject({ cost: 25, unlocked: true, affordable: true });
    expect(kapre).toMatchObject({ unlocked: false });
```

Run: `npx vitest run tests/ui/uiState.test.ts`
Expected: FAIL — `buildUiState` takes no 6th argument / `vm.opponent` undefined.

- [ ] **Step 2: Extend the view-model**

In `src/ui/uiState.ts`:

```ts
import { SEND_TABLE } from '../game/config/sends';
import { ENEMY_TYPES } from '../game/config/enemies';
```

Add the VM types:

```ts
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
```

Add to `UiState`:

```ts
  opponent?: OpponentVM | null;
  sends?: SendVM[];
```

Change `buildUiState` signature and body:

```ts
export function buildUiState(
  world: WorldLike,
  selectedHeroId: string | null,
  bestWave: number,
  heroOrder: string[],
  heroTypes: Record<string, HeroType>,
  mp?: { opponent: OpponentVM | null },
): UiState {
  return {
    // ...existing fields unchanged...
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
    // ...
  };
}
```

- [ ] **Step 3: Run the uiState test**

Run: `npx vitest run tests/ui/uiState.test.ts` → PASS.

- [ ] **Step 4: Render opponent strip + send panel**

In `src/ui/index.ts`:

Add to the `UI` interface:

```ts
  onSend: (enemyTypeId: string) => void;
  onConcede: () => void;
```

In `createUI`, after the `bestStat` block, add the opponent strip (hidden until MP fills it):

```ts
  const oppStat = el('div', 'ui-stat ui-opp', top);
  oppStat.style.display = 'none';
  const oppBox = el('div', 'ui-statval', oppStat);
  el('span', 'ui-lab', oppBox).textContent = 'Rival';
  const oppV = el('b', '', oppBox);
```

After the `bossBanner` block, add the send panel (hidden unless MP):

```ts
  // multiplayer send panel: spend gold to attack the rival
  const sendPanel = el('div', 'ui-sends', overlay);
  sendPanel.style.display = 'none';
  el('div', 'ui-sends-title', sendPanel).textContent = 'SEND';
  const sendBtns = new Map<string, HTMLButtonElement>();
  const sendBox = el('div', 'ui-sends-list', sendPanel);
  const concedeBtn = el<HTMLButtonElement>('button', 'ui-sends-concede', sendPanel);
  concedeBtn.textContent = 'CONCEDE';
  concedeBtn.addEventListener('click', () => ui.onConcede());
```

In the `ui` object literal, add defaults:

```ts
    onSend: () => {},
    onConcede: () => {},
```

In `update(vm)`, append:

```ts
      if (vm.opponent) {
        oppStat.style.display = 'flex';
        oppV.textContent = `${vm.opponent.nickname} · ♥${vm.opponent.lives} · W${vm.opponent.wave}`;
      } else {
        oppStat.style.display = 'none';
      }
      if (vm.sends) {
        sendPanel.style.display = 'flex';
        for (const s of vm.sends) {
          let btn = sendBtns.get(s.id);
          if (!btn) {
            btn = el<HTMLButtonElement>('button', 'ui-send-btn', sendBox);
            const id = s.id;
            btn.addEventListener('click', () => ui.onSend(id));
            sendBtns.set(s.id, btn);
          }
          btn.textContent = s.unlocked ? `${s.name} $${s.cost}` : `${s.name} 🔒w${s.unlockWave}`;
          btn.disabled = !s.unlocked || !s.affordable;
        }
      } else {
        sendPanel.style.display = 'none';
      }
```

IMPORTANT (project convention: no emojis in UI) — replace the lock emoji with text:

```ts
          btn.textContent = s.unlocked ? `${s.name} $${s.cost}` : `${s.name} — wave ${s.unlockWave}`;
```

- [ ] **Step 5: Send panel CSS**

Append to `src/ui/ui.css`:

```css
/* ---- multiplayer: opponent strip + send panel ---- */
.ui-opp .ui-statval b { color: #ffb09a; }
.ui-sends {
  position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
  display: flex; flex-direction: column; gap: 6px; width: 138px; pointer-events: auto;
  padding: 8px; box-sizing: border-box;
  background: linear-gradient(#7d5d34, #5c4324); border: 3px solid #3a2914; border-radius: 10px;
  box-shadow: 0 6px 14px rgba(0,0,0,.45);
}
.ui-sends-title { text-align: center; font-size: 11px; font-weight: 800; letter-spacing: 2px; color: #f0d999; }
.ui-sends-list { display: flex; flex-direction: column; gap: 5px; }
.ui-send-btn {
  padding: 6px 4px; cursor: pointer; color: #2c1f0f; font-weight: 800; font-size: 10.5px;
  font-family: inherit;
  background: linear-gradient(#caa24a, #a9802f); border: 2px solid #3a2914; border-radius: 6px;
  box-shadow: 0 2px 0 #5c4012, inset 0 1px 0 #f0d999;
}
.ui-send-btn:disabled { filter: grayscale(.6) brightness(.7); cursor: not-allowed; box-shadow: none; }
.ui-sends-concede {
  margin-top: 2px; padding: 5px; cursor: pointer; color: #f6e6bd; font-weight: 800; font-size: 10px;
  font-family: inherit;
  background: linear-gradient(#8a4a3a, #6e3527); border: 2px solid #3a2914; border-radius: 6px;
}
```

- [ ] **Step 6: Verify and commit**

Run: `npx tsc --noEmit` → clean. Run: `npx vitest run` → all PASS (solo `buildUiState` calls omit the new optional arg, so nothing breaks).

```bash
git add src/ui/uiState.ts src/ui/index.ts src/ui/ui.css tests/ui/uiState.test.ts
git commit -m "feat(mp): opponent HUD strip + send panel view-model and DOM"
```

---

### Task 10: GameScene MP mode + main flow (ready/countdown) + smoke test

**Files:**
- Modify: `src/scenes/GameScene.ts`, `src/main.ts`, `src/ui/ui.css`

- [ ] **Step 1: GameScene multiplayer wiring**

In `src/scenes/GameScene.ts`:

```ts
import { getSession, type MatchSession } from '../net/session';
import { finishMatch } from '../net/matchService';
import { SEND_TABLE } from '../game/config/sends';
import type { OpponentVM } from '../ui/uiState';
```

Add fields:

```ts
  private mp: MatchSession | null = null;
  private opponent: OpponentVM | null = null;
  private statusTimer = 0;
  private forfeitTimer: number | null = null; // seconds until opponent forfeits, when absent
  private wantRematch = false;
  private peerWantsRematch = false;
```

At the end of `create()` add:

```ts
    this.mp = getSession();
    if (this.mp) this.initMultiplayer(this.mp);
```

Add the methods:

```ts
  private initMultiplayer(mp: MatchSession): void {
    this.opponent = { nickname: mp.opponentNickname, lives: 20, wave: 0 };
    this.wantRematch = false;
    this.peerWantsRematch = false;
    mp.transport.on('send', (e) => this.world.queueIncomingSend(e.enemyTypeId, e.count));
    mp.transport.on('status', (e) => {
      if (this.opponent) {
        this.opponent.lives = e.lives;
        this.opponent.wave = e.wave;
      }
    });
    mp.transport.on('defeat', () => this.winMatch());
    mp.transport.on('peerLeave', () => {
      if (this.world.status === 'playing') this.forfeitTimer = 30;
    });
    mp.transport.on('peerJoin', () => {
      this.forfeitTimer = null;
    });
    mp.transport.on('rematch', () => {
      this.peerWantsRematch = true;
      this.maybeRematch();
    });
    const ui = getUI();
    ui.onSend = (enemyTypeId) => {
      const option = SEND_TABLE.find((o) => o.enemyTypeId === enemyTypeId);
      if (option && this.world.buySend(option)) {
        mp.transport.emit('send', { enemyTypeId, count: 1 });
      }
    };
    ui.onConcede = () => {
      if (this.world.status === 'playing') this.world.state.loseLife(this.world.lives);
    };
  }

  private winMatch(): void {
    if (!this.mp || this.world.status !== 'playing') return;
    this.world.state.win();
    void finishMatch(this.mp.matchId, this.mp.myId);
  }

  private maybeRematch(): void {
    if (this.wantRematch && this.peerWantsRematch && this.world.status !== 'playing') {
      this.scene.restart();
    }
  }
```

In `update()`, after the `this.world.update(...)` call, add:

```ts
    if (this.mp && this.world.status === 'playing') {
      this.statusTimer += delta / 1000;
      if (this.statusTimer >= 0.5) {
        this.statusTimer = 0;
        this.mp.transport.emit('status', {
          wave: this.world.waveNumber,
          lives: this.world.lives,
          gold: this.world.gold,
        });
      }
      if (this.forfeitTimer !== null) {
        this.forfeitTimer -= delta / 1000;
        if (this.forfeitTimer <= 0) {
          this.forfeitTimer = null;
          this.winMatch();
        }
      }
    }
```

Change the `buildUiState` call to pass the MP context:

```ts
    getUI().update(
      buildUiState(this.world, this.selectedHeroId, this.bestWave, getLoadout(), HERO_TYPES,
        this.mp ? { opponent: this.opponent } : undefined),
    );
```

In `handleEndState()` (fires once when the game ends), notify the peer on our own defeat:

```ts
  private handleEndState(): void {
    if (this.world.status === 'playing' || this.endHandled) return;
    this.endHandled = true;
    saveBestWave(this.world.waveNumber);
    this.bestWave = Math.max(this.bestWave, this.world.waveNumber);
    if (this.mp && this.world.status === 'lost') {
      this.mp.transport.emit('defeat');
    }
  }
```

Repurpose Restart as Rematch in MP — in `create()` where `ui.onRestart` is set:

```ts
    ui.onRestart = () => {
      if (this.world.status === 'playing') return;
      if (this.mp) {
        this.wantRematch = true;
        this.mp.transport.emit('rematch');
        this.maybeRematch();
      } else {
        this.scene.restart();
      }
    };
```

Sent-enemy marker — in `drawHpBars()`, inside the enemy loop after the bar drawing, add:

```ts
      if (e.sent) {
        g.fillStyle(0xff5544, 1);
        g.fillTriangle(e.pos.x, y - 6, e.pos.x - 4, y - 1, e.pos.x + 4, y - 1);
      }
```

(The existing loop already computes `y` for the bar; reuse it.)

- [ ] **Step 2: main.ts — multiplayer flow with ready/countdown**

In `src/main.ts` add imports:

```ts
import { showLobby } from './ui/lobby';
import { setSession, type MatchSession } from './net/session';
```

Replace the `showHomeScreen({...})` call at the bottom with:

```ts
function startGame(): void {
  createUI(document.getElementById('game')!);
  if (!game) game = new Phaser.Game(config);
  fitToViewport();
}

// Both players picked cards and clicked TO BATTLE; start when both are ready.
function readyThenStart(session: MatchSession): void {
  let meReady = false;
  let peerReady = false;
  const overlay = document.createElement('div');
  overlay.className = 'ui-countdown';
  overlay.textContent = 'Waiting for your rival…';
  document.body.appendChild(overlay);
  const maybeStart = (): void => {
    if (!meReady || !peerReady) return;
    let n = 3;
    overlay.textContent = String(n);
    const tick = window.setInterval(() => {
      n -= 1;
      if (n > 0) {
        overlay.textContent = String(n);
      } else {
        window.clearInterval(tick);
        overlay.remove();
        startGame();
      }
    }, 1000);
  };
  session.transport.on('ready', () => {
    peerReady = true;
    maybeStart();
  });
  session.transport.on('peerLeave', () => {
    overlay.textContent = 'Rival left. Returning home…';
    setTimeout(() => location.reload(), 1500);
  });
  session.transport.emit('ready');
  meReady = true;
  maybeStart();
}

showHomeScreen({
  onInfinite: () => {
    showHeroSelect({
      onStart: (loadout) => {
        setLoadout(loadout);
        startGame();
      },
    });
  },
  onMultiplayer: () => {
    showLobby({
      onBack: () => location.reload(),
      onMatched: (session) => {
        setSession(session);
        showHeroSelect({
          onStart: (loadout) => {
            setLoadout(loadout);
            readyThenStart(session);
          },
        });
      },
    });
  },
});
```

There is a race: if the peer's `ready` broadcast arrives before `readyThenStart` registers its handler (peer picked cards faster), the event is lost. Fix by registering the ready listener at `onMatched` time instead — adjust: move `let peerReady = false;` and the `session.transport.on('ready', ...)` registration into `onMatched`, before `showHeroSelect`:

```ts
      onMatched: (session) => {
        setSession(session);
        const readyState = { peerReady: false, onPeerReady: () => {} };
        session.transport.on('ready', () => {
          readyState.peerReady = true;
          readyState.onPeerReady();
        });
        showHeroSelect({
          onStart: (loadout) => {
            setLoadout(loadout);
            readyThenStart(session, readyState);
          },
        });
      },
```

and change the signature:

```ts
function readyThenStart(
  session: MatchSession,
  readyState: { peerReady: boolean; onPeerReady: () => void },
): void {
  const overlay = document.createElement('div');
  overlay.className = 'ui-countdown';
  overlay.textContent = 'Waiting for your rival…';
  document.body.appendChild(overlay);
  let started = false;
  const maybeStart = (): void => {
    if (started || !readyState.peerReady) return;
    started = true;
    let n = 3;
    overlay.textContent = String(n);
    const tick = window.setInterval(() => {
      n -= 1;
      if (n > 0) {
        overlay.textContent = String(n);
      } else {
        window.clearInterval(tick);
        overlay.remove();
        startGame();
      }
    }, 1000);
  };
  readyState.onPeerReady = maybeStart;
  session.transport.on('peerLeave', () => {
    if (!started) {
      overlay.textContent = 'Rival left. Returning home…';
      setTimeout(() => location.reload(), 1500);
    }
  });
  session.transport.emit('ready');
  maybeStart();
}
```

Use this race-safe version (not the first sketch).

- [ ] **Step 3: Countdown CSS**

Append to `src/ui/ui.css`:

```css
.ui-countdown {
  position: fixed; inset: 0; z-index: 120; display: flex; align-items: center; justify-content: center;
  font-family: 'Trebuchet MS', system-ui, sans-serif; font-size: 56px; font-weight: 800;
  color: #f0d999; text-shadow: 0 3px 0 #2c1f0f, 0 0 24px rgba(240,217,153,.4);
  background: rgba(10, 14, 10, .82); letter-spacing: 2px;
}
```

- [ ] **Step 4: Full verification**

Run: `npx tsc --noEmit` → clean.
Run: `npx vitest run` → all suites PASS.
Run: `npm run build` → builds.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/GameScene.ts src/main.ts src/ui/ui.css
git commit -m "feat(mp): in-match versus wiring — sends, status, defeat, forfeit, rematch, countdown"
```

---

### Task 11: Two-client smoke test (manual, user-assisted)

**Files:** none (verification)

- [ ] **Step 1: Start the dev server**

Run: `NODE_OPTIONS='--max-http-header-size=131072' npx vite --port 5173 --strictPort` (background).

- [ ] **Step 2: Two-tab session**

Two anonymous Supabase sessions need two separate browser contexts (a second tab shares localStorage → same user). Ask the user to open `http://localhost:5173` in (a) a normal window and (b) an incognito window, then:

1. Window A: Multiplayer → nickname → CREATE ROOM → note the code.
2. Window B: Multiplayer → nickname → enter code → JOIN.
3. Both: pick 4 cards → TO BATTLE → both see 3-2-1 → match starts.
4. A: send a Tiyanak (gold ≥ 25) → B sees a marked extra enemy enter promptly; A's gold dropped.
5. Both: opponent strip shows the other's nickname/lives/wave updating.
6. B: CONCEDE → B sees DEFEAT, A sees VICTORY (check `matches.status='done'`, `winner_id` = A via MCP `execute_sql`: `select status, winner_id from matches order by created_at desc limit 1;`).
7. Both click REMATCH → both boards restart together.
8. Quick match: A and B both choose QUICK MATCH from fresh lobbies → they pair.
9. Forfeit: close window B mid-match → A wins after ~30 s.

- [ ] **Step 3: Fix anything found, then final commit**

Any fixes discovered get their own commits. Then verify `npx vitest run` and `npm run build` one last time.

---

## Self-review notes (done at planning time)

- **Spec coverage:** schema/RLS+anon auth (T1), env/client (T2), transport interface + fake (T3), service incl. room codes, atomic claim, queue, results (T4), realtime transport (T5), incoming sends w/ receiver-wave scaling + marker (T6, T10), send table/gold/unlocks (T7), nickname+lobby+home button (T8), opponent strip+send panel (T9), status pings/defeat/forfeit/concede/rematch/ready-countdown (T10), manual 2-client verification incl. quick match & forfeit (T11). Out-of-scope items from the spec are not implemented anywhere. ✓
- **Types:** `MatchTransport.emit` overloads match usage in T10; `MatchSession` fields used in lobby (T8) and GameScene (T10) agree; `buildUiState` optional 6th arg keeps solo callers compiling. ✓
- **Known accepted risks:** realtime channels are public-but-unguessable (spec-accepted); rematch overwrites the same match row's result; presence race on guest join is covered by the 4 s nickname fallback + `done()` double-fire guard.
