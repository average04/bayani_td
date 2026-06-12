import { getSupabase } from './supabaseClient';

export interface MatchRow {
  id: string;
  code: string;
  host_id: string;
  guest_id: string | null;
}

// 5 chars from an unambiguous alphabet (no 0/O/1/I) ≈ 28M codes — typeable but not
// brute-forceable now that rooms are private (only the holder of the code can join).
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function generateCode(): string {
  let c = '';
  for (let i = 0; i < 5; i++) c += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return `BAYAN-${c}`;
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

/** Create a private room (status 'waiting'); retries on the rare code collision.
 * The row is readable only by its participants (RLS), so the code is a real secret. */
export async function createRoom(userId: string): Promise<MatchRow> {
  return insertMatch(userId, 'waiting');
}

/** Join a room by code via the server RPC (atomic claim; the table itself isn't exposed). */
export async function joinRoom(_userId: string, codeInput: string): Promise<MatchRow | null> {
  const { data, error } = await getSupabase().rpc('join_match', { p_code: normalizeCode(codeInput) });
  if (error) throw error;
  return (data as MatchRow) ?? null; // null when no open room matched the code
}

/** Quick match via the server RPC: claims the oldest opponent or enqueues us. */
export async function quickMatch(userId: string): Promise<{ match: MatchRow; isHost: boolean }> {
  const { data, error } = await getSupabase().rpc('quick_match');
  if (error || !data) throw error ?? new Error('matchmaking failed');
  const match = data as MatchRow;
  return { match, isHost: match.host_id === userId };
}

/** How many players are sitting in the quick-match queue right now (server-counted). */
export async function countSearching(): Promise<number> {
  const { data } = await getSupabase().rpc('count_searching');
  return (data as number) ?? 0;
}

/** Cancel an own still-open room/queue entry (RLS delete policy enforces ownership). */
export async function cancelMatch(matchId: string): Promise<void> {
  await getSupabase().from('matches').delete().eq('id', matchId);
}

/** Record the result via the server RPC — the caller becomes the winner (server-verified). */
export async function finishMatch(matchId: string, _winnerId?: string): Promise<void> {
  await getSupabase().rpc('finish_match', { p_match: matchId });
}

export async function fetchNicknameOf(userId: string): Promise<string> {
  return (await getNickname(userId)) ?? 'Opponent';
}
