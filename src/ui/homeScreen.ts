import { HERO_ORDER } from '../game/config/heroes';

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
    <p class="ui-home-note" id="home-note"></p>
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
}
