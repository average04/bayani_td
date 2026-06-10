# Bayani TD — Multiplayer v1: Versus 1v1 (send monsters)

Date: 2026-06-10
Status: approved (design dialogue 2026-06-10)

## Goal

Make the home screen's "Multiplayer" button real: two players battle 1v1. Each defends
their own board against the normal endless waves; gold can be spent to send extra
monsters at the opponent; last base standing wins.

## Decisions (locked with user)

| Question | Decision |
|---|---|
| Mode | Versus 1v1 with enemy-sending (Bloons-Battles style) |
| Matchmaking | Room codes AND quick-match queue, both in v1 |
| Identity | Supabase anonymous auth + chosen nickname |
| Send economy | Sends cost gold (one resource); stronger sends unlock by wave |
| Architecture | Client-simulated boards + Supabase Realtime events (trusted clients) |

## Architecture

Each browser runs its own `World` exactly as solo play does today. The network carries
only small events over one Supabase Realtime channel per match (`match:{id}`):

- `send` — `{ enemyTypeId, count }`: spawn extras on the receiver's board
- `status` — `{ wave, lives, gold }`: opponent HUD strip, sent ~2x/second
- `defeat` — sender's lives hit 0; receiver wins instantly
- presence — join/leave; a player absent for 30 s forfeits

Rationale: no new servers, no determinism/lockstep requirements, latency-tolerant
(sends are the only cross-board interaction). Trade-off: clients are trusted — a
cheater can edit their own sim. Acceptable for friendly 1v1 at current scale;
an authoritative server or lockstep can replace the transport later because all
networking sits behind one small interface.

## Match flow

1. Home → **Multiplayer** → first run: nickname prompt (creates anonymous Supabase
   session + `profiles` row).
2. Lobby screen, three actions:
   - **Create room** → match row with short code (e.g. `BAYAN-42`), waits for joiner
   - **Join room** → enter code
   - **Quick match** → joins the queue; pairs with the oldest waiting player
3. Both players pick their 4 hero cards (existing select screen, per player).
4. Ready-up → 3-2-1 countdown (via broadcast) → battle.
5. End: one side's lives reach 0 (`defeat` broadcast), opponent disconnects past the
   grace period (forfeit), or a player concedes. Result written to `matches`,
   Victory/Defeat screen with Rematch (new match, same room) / Home.

## Versus rules

- Both boards run the normal endless wave schedule independently (auto-advance as in
  solo). The late-wave HP ramp guarantees matches end.
- Opponent HUD strip: nickname, lives, wave.
- **Send panel** beside the build bar; each entry has a gold cost and a wave unlock
  (initial numbers, balance pass later):

  | Monster | Cost | Unlocks |
  |---|---|---|
  | Tiyanak | $25 | wave 1 |
  | Tiktik | $35 | wave 2 |
  | Aswang | $50 | wave 4 |
  | Manananggal | $90 | wave 7 |
  | Kapre | $120 | wave 9 |
  | Bakunawa | $500 | wave 15 |

- Unlock wave = the **sender's** current wave. Sent monsters spawn at the receiver's
  path entrance, scaled by `scaledMaxHp` at the **receiver's** current wave, with a
  visual marker (tint/badge) distinguishing them from scheduled spawns. They grant
  normal kill gold.
- Hero cards, stores (cap 2), upgrades: unchanged from solo.

## Backend (Supabase project `rmltqxuvlqzngtdcadwx`)

- **Auth**: anonymous sign-in; nickname stored in `profiles`.
- **Tables**:
  - `profiles(user_id pk → auth.users, nickname text, created_at)`
  - `matches(id pk, code text unique, status text: searching|waiting|active|done,
    host_id, guest_id, winner_id, created_at, finished_at)`
    - room flow: `waiting` → `active` → `done`
    - queue flow: `searching` rows ARE the queue; quick-match claims the oldest
      via an atomic conditional update (no double-claim)
- **RLS**: players select/update only matches they're in; `searching`/`waiting` rows
  are joinable; profiles readable by all, writable by owner.
- No Edge Functions in v1.

## Client

- `src/net/`: supabase client setup, `matchService` (create/join/queue/finish),
  `MatchChannel` — a thin wrapper over Realtime broadcast/presence with a
  `FakeChannel` twin for unit tests.
- `src/ui/lobby.ts`: nickname prompt + lobby (create/join/quick-match/waiting states).
- Game changes:
  - `World.queueIncomingSend(enemyTypeId, count)` — folds extra spawns into the
    current wave (spawn immediately at the entrance on the next ticks)
  - send API: validate unlock wave + gold, debit, emit outgoing event
  - `GameScene` MP mode: opponent HUD strip, send panel, MP end conditions
  - solo Infinite path untouched
- New dependency: `@supabase/supabase-js`. Anon key + URL via Vite env vars.

## Testing

- Unit (vitest): incoming-send spawn queueing and HP scaling; send validation
  (gold/unlock); match-end transitions; lobby/queue state machine against
  `FakeChannel`/fake service.
- Manual: two browser tabs (two anonymous sessions) through room-code and
  quick-match flows; disconnect/forfeit; rematch.

## Out of scope (v1)

Rankings/ELO, spectating, mid-match reconnection, anti-cheat/server authority,
additional maps, mobile layout, send-eco income mechanic (v2 candidate).
