// Sound effects. One module that works in BOTH Phaser scenes and the plain-DOM UI
// (home screen, lobby, countdown), so it wraps lightweight HTMLAudioElements rather
// than Phaser's per-scene sound manager — no scene reference needed anywhere.
//
// All cues are CC0 (public domain), sourced from Kenney's audio packs:
//   Impact Sounds · RPG Audio · Interface Sounds · Music Jingles · Sci-fi Sounds · Digital Audio
// Files live in two formats per cue (ogg + mp3) under public/assets/audio; we pick the
// one the browser can decode (Safari has no Vorbis, everything else prefers ogg).

export type SfxName =
  // per-hero attack cues (one per signature weapon) + a fallback for any unmapped hero
  | 'attack-lapulapu' | 'attack-gabriela' | 'attack-bernardo' | 'attack-diwata'
  | 'attack-mangkukulam' | 'attack-apolaki' | 'attack-rizal' | 'attack-bonifacio'
  | 'attack-default'
  // combat impacts / rewards
  | 'hit' | 'crit' | 'quake' | 'enemy-death' | 'boss-death' | 'gold'
  // game-state beats
  | 'leak' | 'low-lives' | 'wave-start' | 'boss-spawn' | 'wave-clear' | 'victory' | 'defeat'
  // build + UI feedback
  | 'place' | 'error' | 'upgrade' | 'sell' | 'arm' | 'cancel' | 'click'
  // multiplayer
  | 'send-in' | 'send-out' | 'match-found' | 'count-tick' | 'count-go' | 'peer-leave' | 'peer-join';

interface CueDef {
  vol: number; // base loudness 0..1 (before the master volume / mute)
  throttle?: number; // min ms between retriggers of this exact cue (default below)
  pool?: number; // overlapping voices (attacks fire fast and want several)
}

// Per-cue mix. Attacks/hits are quiet because they fire constantly; state beats and the
// win/lose stingers are loud because they're rare and meant to land.
const CUES: Record<SfxName, CueDef> = {
  'attack-lapulapu': { vol: 0.3, throttle: 90, pool: 4 },
  'attack-gabriela': { vol: 0.22, throttle: 70, pool: 5 },
  'attack-bernardo': { vol: 0.32, throttle: 90, pool: 4 },
  'attack-diwata': { vol: 0.26, throttle: 80, pool: 4 },
  'attack-mangkukulam': { vol: 0.3, throttle: 90, pool: 4 },
  'attack-apolaki': { vol: 0.34, throttle: 90, pool: 4 },
  'attack-rizal': { vol: 0.3, throttle: 90, pool: 4 },
  'attack-bonifacio': { vol: 0.3, throttle: 90, pool: 4 },
  'attack-default': { vol: 0.28, throttle: 80, pool: 4 },
  hit: { vol: 0.22, throttle: 60, pool: 5 },
  crit: { vol: 0.5, throttle: 70, pool: 3 },
  quake: { vol: 0.55, throttle: 120 },
  'enemy-death': { vol: 0.28, throttle: 60, pool: 5 },
  'boss-death': { vol: 0.8 },
  gold: { vol: 0.3, throttle: 90, pool: 3 },
  leak: { vol: 0.7, throttle: 150 },
  'low-lives': { vol: 0.75 },
  'wave-start': { vol: 0.6 },
  'boss-spawn': { vol: 0.85 },
  'wave-clear': { vol: 0.55 },
  victory: { vol: 0.75 },
  defeat: { vol: 0.7 },
  place: { vol: 0.5 },
  error: { vol: 0.45 },
  upgrade: { vol: 0.55 },
  sell: { vol: 0.5 },
  arm: { vol: 0.4 },
  cancel: { vol: 0.4 },
  click: { vol: 0.4 },
  'send-in': { vol: 0.7 },
  'send-out': { vol: 0.5 },
  'match-found': { vol: 0.7 },
  'count-tick': { vol: 0.55 },
  'count-go': { vol: 0.75 },
  'peer-leave': { vol: 0.55 },
  'peer-join': { vol: 0.55 },
};

const BASE_PATH = 'assets/audio';
const DEFAULT_THROTTLE = 70;
const DEFAULT_POOL = 3;
const VOL_KEY = 'bayani.sfx.vol';
const MUTE_KEY = 'bayani.sfx.muted';

// ogg everywhere it decodes (smaller, looped cleaner); mp3 for Safari.
const EXT = ((): 'ogg' | 'mp3' => {
  try {
    return new Audio().canPlayType('audio/ogg; codecs="vorbis"') ? 'ogg' : 'mp3';
  } catch {
    return 'mp3';
  }
})();

interface Voice {
  els: HTMLAudioElement[];
  next: number;
  last: number; // performance.now() of the last trigger, for throttling
}

const voices = new Map<SfxName, Voice>();

function readMaster(): number {
  const raw = localStorage.getItem(VOL_KEY);
  const n = raw === null ? 0.8 : Number(raw);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.8;
}

let master = readMaster();
let muted = localStorage.getItem(MUTE_KEY) === '1';
const muteListeners = new Set<() => void>();

function makeVoice(name: SfxName): Voice {
  const def = CUES[name];
  const count = def.pool ?? DEFAULT_POOL;
  const els: HTMLAudioElement[] = [];
  for (let i = 0; i < count; i++) {
    const a = new Audio(`${BASE_PATH}/${name}.${EXT}`);
    a.preload = 'auto';
    els.push(a);
  }
  return { els, next: 0, last: 0 };
}

function voiceFor(name: SfxName): Voice {
  let v = voices.get(name);
  if (!v) {
    v = makeVoice(name);
    voices.set(name, v);
  }
  return v;
}

/** Build every cue's audio pool up front so the first trigger has no fetch latency. */
export function primeSfx(): void {
  for (const name of Object.keys(CUES) as SfxName[]) voiceFor(name);
}

/** Play a cue once. No-ops while muted, at zero volume, or inside its throttle window. */
export function playSfx(name: SfxName): void {
  if (muted || master <= 0) return;
  const def = CUES[name];
  if (!def) return;
  const v = voiceFor(name);
  const now = performance.now();
  if (now - v.last < (def.throttle ?? DEFAULT_THROTTLE)) return;
  v.last = now;
  const el = v.els[v.next];
  v.next = (v.next + 1) % v.els.length;
  el.volume = Math.min(1, def.vol * master);
  try {
    el.currentTime = 0;
  } catch {
    /* not yet seekable; play from wherever it is */
  }
  // Autoplay policy may reject until the first user gesture — swallow it quietly.
  void el.play().catch(() => {});
}

/** Map a hero id to its attack cue, falling back to the generic shot for unmapped heroes. */
export function playHeroAttack(heroId: string): void {
  const name = `attack-${heroId}` as SfxName;
  playSfx(name in CUES ? name : 'attack-default');
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean): void {
  muted = value;
  localStorage.setItem(MUTE_KEY, value ? '1' : '0');
  for (const fn of muteListeners) fn();
}

export function toggleMuted(): boolean {
  setMuted(!muted);
  return muted;
}

/** Subscribe to mute changes (e.g. to repaint a speaker icon). Returns an unsubscribe fn. */
export function onMuteChange(fn: () => void): () => void {
  muteListeners.add(fn);
  return () => muteListeners.delete(fn);
}

export function getVolume(): number {
  return master;
}

export function setVolume(value: number): void {
  master = Math.min(1, Math.max(0, value));
  localStorage.setItem(VOL_KEY, String(master));
}
