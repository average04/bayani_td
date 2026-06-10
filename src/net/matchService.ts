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

/** Insert a match row with a fresh code, retrying on the rare code collision. */
async function insertMatch(userId: string, status: 'waiting' | 'searching'): Promise<MatchRow> {
  const sb = getSupabase();
  for (let i = 0; i < 5; i++) {
    const code = generateCode();
    const { data, error } = await sb
      .from('matches')
      .insert({ code, status, host_id: userId })
      .select('id, code, host_id, guest_id')
      .single();
    if (data) return data;
    if (error && error.code !== '23505') throw error; // 23505 = unique_violation -> retry
  }
  throw new Error('could not allocate a room code');
}

/** Create a private room (status 'waiting'); retries on the rare code collision. */
export async function createRoom(userId: string): Promise<MatchRow> {
  return insertMatch(userId, 'waiting');
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
  const match = await insertMatch(userId, 'searching');
  return { match, isHost: true };
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
