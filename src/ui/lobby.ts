import { supabaseConfigured } from '../net/supabaseClient';
import {
  ensureSession, getNickname, saveNickname, createRoom, joinRoom, quickMatch,
  cancelMatch, countSearching, type MatchRow,
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
  let finished = false;
  let queuePoll: number | null = null;

  const stopQueuePoll = (): void => {
    if (queuePoll !== null) {
      window.clearInterval(queuePoll);
      queuePoll = null;
    }
  };

  const swap = (node: HTMLElement): void => {
    stopQueuePoll(); // leaving whatever view was polling
    inner.innerHTML = '';
    inner.appendChild(node);
  };

  // a slowly rotating sun-ray ring — the "looking for someone" animation
  const spinner = (): string => `<span class="ui-lobby-spinner"></span>`;

  const fail = (msg: string, retry: () => void): void => {
    const v = el(`<div class="ui-lobby-box">
      <p class="ui-lobby-err"></p>
      <button class="ui-lobby-btn" data-a="retry">TRY AGAIN</button>
      <button class="ui-lobby-btn ghost" data-a="back">BACK</button>
    </div>`);
    v.querySelector('.ui-lobby-err')!.textContent = msg;
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
    swap(el(`<div class="ui-lobby-wait">${spinner()}<p class="ui-lobby-note">Connecting…</p></div>`));
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
    leaving = false;
    const v = el(`<div class="ui-lobby-box">
      <h2>Multiplayer — Versus</h2>
      <p class="ui-lobby-note">Playing as <b></b></p>
      <button class="ui-lobby-btn primary" data-a="quick">QUICK MATCH</button>
      <div class="ui-lobby-sep">or play a friend</div>
      <button class="ui-lobby-btn" data-a="create">CREATE ROOM</button>
      <div class="ui-lobby-joinrow">
        <input class="ui-lobby-input" maxlength="10" placeholder="BAYAN-0000" />
        <button class="ui-lobby-btn" data-a="join">JOIN</button>
      </div>
      <button class="ui-lobby-btn ghost" data-a="back">BACK</button>
    </div>`);
    v.querySelector('.ui-lobby-note b')!.textContent = myNickname;
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
      const v = el(`<div class="ui-lobby-box">
        ${spinner()}
        <p class="ui-lobby-note"></p>
        <p class="ui-lobby-queue"></p>
        <button class="ui-lobby-btn ghost">CANCEL</button>
      </div>`);
      const note = v.querySelector<HTMLElement>('.ui-lobby-note')!;
      const queueLine = v.querySelector<HTMLElement>('.ui-lobby-queue')!;
      if (kind === 'room') {
        note.innerHTML = `Room code: <b class="ui-lobby-code"></b><br/>Waiting for your rival…`;
        note.querySelector('.ui-lobby-code')!.textContent = row.code;
        queueLine.style.display = 'none';
      } else {
        note.textContent = 'Searching for a rival…';
      }
      v.querySelector('button')!.addEventListener('click', () => {
        leaving = true;
        transport.leave();
        void cancelMatch(row.id);
        menu(myId, myNickname);
      });
      swap(v);
      if (kind === 'queue') {
        // live queue size (refreshed every 3s; includes yourself)
        const refreshQueue = (): void => {
          void countSearching().then((n) => {
            queueLine.textContent = n <= 1 ? 'You are first in the queue' : `${n} players in the queue`;
          });
        };
        refreshQueue();
        queuePoll = window.setInterval(refreshQueue, 3000);
      }
      transport.on('peerJoin', (oppNick) => {
        if (leaving) return;
        // the guest's join_match / quick_match RPC already flipped the row to 'active'
        done({ matchId: row.id, myId, isHost: true, myNickname, opponentNickname: oppNick, transport });
      });
      await transport.join(myNickname);
    } catch (e) {
      fail(`Could not open a room: ${(e as Error).message}`, () => menu(myId, myNickname));
    }
  }

  /** Guest path: claimed a row, join the channel; host is (or will be) present. */
  async function guest(myId: string, myNickname: string, row: MatchRow): Promise<void> {
    swap(el(`<div class="ui-lobby-wait">${spinner()}<p class="ui-lobby-note">Joining…</p></div>`));
    const transport = new MatchChannel(row.id);
    transport.on('peerJoin', (oppNick) => {
      done({ matchId: row.id, myId, isHost: false, myNickname, opponentNickname: oppNick, transport });
    });
    try {
      await transport.join(myNickname);
      // presence never showed the host: the room is dead (host left mid-join) — bail out
      setTimeout(() => {
        if (finished) return;
        transport.leave();
        fail('The host is not responding. Try another room or quick match.', () => menu(myId, myNickname));
      }, 10_000);
    } catch (e) {
      fail(`Could not join: ${(e as Error).message}`, () => menu(myId, myNickname));
    }
  }

  async function join(myId: string, myNickname: string, code: string): Promise<void> {
    if (!code.trim()) return;
    swap(el(`<div class="ui-lobby-wait">${spinner()}<p class="ui-lobby-note">Looking for the room…</p></div>`));
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
    swap(el(`<div class="ui-lobby-wait">${spinner()}<p class="ui-lobby-note">Searching…</p></div>`));
    try {
      const { match, isHost } = await quickMatch(myId);
      if (isHost) await host(myId, myNickname, 'queue', match);
      else await guest(myId, myNickname, match);
    } catch (e) {
      fail(`Matchmaking failed: ${(e as Error).message}`, () => menu(myId, myNickname));
    }
  }

  function done(session: MatchSession): void {
    if (finished) return; // guards the double-fire (presence + fallback timer)
    finished = true;
    stopQueuePoll();
    root.remove();
    cb.onMatched(session);
  }
}
