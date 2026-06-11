import { getSupabase, supabaseConfigured } from './supabaseClient';
import { ensureSession, getNickname, saveNickname } from './matchService';

export interface ScoreRow {
  userId: string;
  nickname: string;
  bestWave: number;
}

export interface LeaderboardState {
  top: ScoreRow[];
  myUserId: string;
  myNickname: string | null;
  myRank: number | null; // null until the player has a saved score
}

export const leaderboardAvailable = (): boolean => supabaseConfigured;

/** Record a finished run: keeps only the player's deepest wave. No-op without a nickname. */
export async function submitBestWave(wave: number): Promise<void> {
  if (!supabaseConfigured || wave < 1) return;
  const userId = await ensureSession();
  if (!(await getNickname(userId))) return; // no identity yet — caller offers the name form
  const sb = getSupabase();
  const { data: existing } = await sb
    .from('infinite_scores')
    .select('best_wave')
    .eq('user_id', userId)
    .maybeSingle();
  if (existing && existing.best_wave >= wave) return;
  await sb
    .from('infinite_scores')
    .upsert({ user_id: userId, best_wave: wave, updated_at: new Date().toISOString() });
}

/** First-time players: save a nickname, then submit in one step. */
export async function saveNameAndSubmit(nickname: string, wave: number): Promise<void> {
  const userId = await ensureSession();
  await saveNickname(userId, nickname);
  await submitBestWave(wave);
}

/** Top N scores plus the viewer's own identity/rank, for rendering one leaderboard view. */
export async function fetchLeaderboard(limit = 10): Promise<LeaderboardState> {
  const sb = getSupabase();
  const userId = await ensureSession();
  const myNickname = await getNickname(userId);
  const { data } = await sb
    .from('infinite_scores')
    .select('user_id, best_wave, profiles(nickname)')
    .order('best_wave', { ascending: false })
    .order('updated_at', { ascending: true })
    .limit(limit);
  const top: ScoreRow[] = (data ?? []).map((r) => ({
    userId: r.user_id as string,
    bestWave: r.best_wave as number,
    // PostgREST embeds the FK row; tolerate both object and array shapes
    nickname:
      ((Array.isArray(r.profiles) ? r.profiles[0] : r.profiles) as { nickname?: string } | null)
        ?.nickname ?? 'Unknown',
  }));

  let myRank: number | null = null;
  const { data: mine } = await sb
    .from('infinite_scores')
    .select('best_wave')
    .eq('user_id', userId)
    .maybeSingle();
  if (mine) {
    const { count } = await sb
      .from('infinite_scores')
      .select('user_id', { count: 'exact', head: true })
      .gt('best_wave', mine.best_wave);
    myRank = (count ?? 0) + 1;
  }
  return { top, myUserId: userId, myNickname, myRank };
}
