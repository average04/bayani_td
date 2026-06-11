import { HERO_ORDER } from '../game/config/heroes';
import { leaderboardAvailable, fetchLeaderboard } from '../net/leaderboard';

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
    <button class="ui-home-lbbtn" id="home-lb">LEADERBOARD</button>
    <div class="ui-home-heroes">${heroes}</div>
  `;
  document.body.appendChild(home);

  home.querySelector<HTMLElement>('#home-infinite')!.addEventListener('click', () => {
    home.remove();
    cb.onInfinite();
  });
  home.querySelector<HTMLElement>('#home-mp')!.addEventListener('click', () => {
    home.remove();
    cb.onMultiplayer();
  });
  home.querySelector<HTMLElement>('#home-lb')!.addEventListener('click', () => showLeaderboardModal());
}

// Modal over the title screen: the global infinite-mode standings.
function showLeaderboardModal(): void {
  const overlay = document.createElement('div');
  overlay.className = 'ui-home-lbmodal';
  const box = document.createElement('div');
  box.className = 'ui-lb ui-lb-modal';
  overlay.appendChild(box);

  const title = document.createElement('div');
  title.className = 'ui-lb-title';
  title.textContent = 'TOP BAYANI — INFINITE';
  box.appendChild(title);

  const status = document.createElement('div');
  status.className = 'ui-lb-status';
  box.appendChild(status);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'ui-lobby-btn ghost';
  closeBtn.textContent = 'CLOSE';
  closeBtn.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);

  if (!leaderboardAvailable()) {
    status.textContent = 'Leaderboard needs Supabase configured (.env.local).';
    box.appendChild(closeBtn);
    return;
  }
  status.textContent = 'Loading…';
  box.appendChild(closeBtn);
  void fetchLeaderboard(20)
    .then((state) => {
      status.remove();
      const list = document.createElement('div');
      list.className = 'ui-lb-list';
      if (state.top.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'ui-lb-status';
        empty.textContent = 'No champions yet — be the first!';
        list.appendChild(empty);
      }
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
      box.insertBefore(list, closeBtn);
      if (state.myNickname && state.myRank !== null && state.myRank > state.top.length) {
        const mine = document.createElement('div');
        mine.className = 'ui-lb-status';
        mine.textContent = `Your rank: #${state.myRank}`;
        box.insertBefore(mine, closeBtn);
      }
    })
    .catch(() => {
      status.textContent = 'Leaderboard unavailable right now.';
    });
}
