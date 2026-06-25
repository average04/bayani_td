import { HERO_ORDER } from '../game/config/heroes';
import { leaderboardAvailable, fetchLeaderboard } from '../net/leaderboard';
import { playSfx } from '../audio/sfx';

export interface HomeScreenCallbacks {
  onInfinite: () => void;
  onMultiplayer: () => void;
}

// Full-screen title overlay with mode selection, shown before the game starts.
export function showHomeScreen(cb: HomeScreenCallbacks): void {
  const home = document.createElement('div');
  home.className = 'ui-home';

  const heroes = HERO_ORDER.map(
    (id) => `<span class="ui-home-hero" style="background-image:url(/assets/ui/portrait-${id}.png)"></span>`,
  ).join('');

  home.innerHTML = `
    <h1 class="ui-home-title">Bayani TD</h1>
    <p class="ui-home-sub">Filipino-mythology tower defense</p>
    <div class="ui-home-modes">
      <button class="ui-home-mode" id="home-infinite">
        <span class="ui-home-mode-name">Infinite</span>
        <span class="ui-home-mode-desc">Survive escalating waves of folklore</span>
      </button>
      <button class="ui-home-mode" id="home-mp">
        <span class="ui-home-mode-name">Multiplayer</span>
        <span class="ui-home-mode-desc">1v1 — send monsters at your rival</span>
      </button>
    </div>
    <div class="ui-lb ui-home-lb" id="home-lb" style="display:none"></div>
    <div class="ui-home-heroes">${heroes}</div>
  `;
  document.body.appendChild(home);

  home.querySelector<HTMLElement>('#home-infinite')!.addEventListener('click', () => {
    playSfx('click');
    home.remove();
    cb.onInfinite();
  });
  home.querySelector<HTMLElement>('#home-mp')!.addEventListener('click', () => {
    playSfx('click');
    home.remove();
    cb.onMultiplayer();
  });
  void loadHomeLeaderboard(home.querySelector<HTMLElement>('#home-lb')!);
}

// The global infinite standings, embedded right on the title screen.
async function loadHomeLeaderboard(box: HTMLElement): Promise<void> {
  if (!leaderboardAvailable()) return; // quietly absent until Supabase is configured

  box.style.display = 'flex';
  const title = document.createElement('div');
  title.className = 'ui-lb-title';
  title.textContent = 'TOP BAYANI — INFINITE';
  const status = document.createElement('div');
  status.className = 'ui-lb-status';
  status.textContent = 'Loading…';
  box.append(title, status);

  try {
    const state = await fetchLeaderboard(5);
    status.remove();
    if (state.top.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'ui-lb-status';
      empty.textContent = 'No champions yet — be the first!';
      box.appendChild(empty);
      return;
    }
    const list = document.createElement('div');
    list.className = 'ui-lb-list';
    state.top.forEach((row, i) => {
      const r = document.createElement('div');
      r.className = 'ui-lb-row' + (row.userId === state.myUserId ? ' me' : '');
      const rank = document.createElement('span');
      rank.className = 'ui-lb-rank';
      rank.textContent = `#${i + 1}`;
      const name = document.createElement('span');
      name.className = 'ui-lb-name';
      name.textContent = row.nickname;
      const wave = document.createElement('span');
      wave.className = 'ui-lb-wave';
      wave.textContent = `W${row.bestWave}`;
      r.append(rank, name, wave);
      list.appendChild(r);
    });
    box.appendChild(list);
    if (state.myNickname && state.myRank !== null && state.myRank > state.top.length) {
      const mine = document.createElement('div');
      mine.className = 'ui-lb-status';
      mine.textContent = `Your rank: #${state.myRank}`;
      box.appendChild(mine);
    }
  } catch {
    status.textContent = 'Leaderboard unavailable right now.';
  }
}
