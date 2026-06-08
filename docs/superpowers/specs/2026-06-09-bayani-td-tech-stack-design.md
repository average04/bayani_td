# Bayani TD — Tech Stack & Architecture Design

- **Date:** 2026-06-09
- **Status:** Design approved — ready for implementation planning
- **Scope of this document:** Overall tech stack, architecture, asset pipeline, backend, and a phased roadmap. The first implementation plan derived from this doc covers **Phases 0–1** (a core playable game). The Supabase backend gets its own later spec/plan.

---

## 1. Vision

Bayani TD is a browser-based **tower defense** game themed around **Philippine mythology**:

- **Towers = Filipino heroes (bayani).**
- **Enemies = native folklore creatures** (aswang, tiktik, and more to come).

The aim is a polished, distinctive, release-quality game with a **pixel-art** aesthetic that celebrates Filipino myth and history.

## 2. Goals & Constraints

| Dimension | Decision |
|---|---|
| **Platform** | Web browser (desktop + mobile browsers), shareable by URL. No native app. |
| **Ambition** | Aiming for public release (itch.io / web). Must be solid and maintainable. |
| **Developer context** | First game ever; strong web / TypeScript background. Favor approachable, well-documented tools. |
| **Art style** | Pixel art. |
| **Backend needs** | Player accounts (Auth), cloud save / progress, leaderboards, and asset/content storage. |

## 3. Tech Stack (Decisions)

| Concern | Choice | Rationale |
|---|---|---|
| Game framework | **Phaser 3** | Batteries-included 2D HTML5 framework: sprites, tilemaps, input, scenes, tweens, audio, particles, arcade physics. Best-documented option; tower defense is a staple tutorial topic. Pixel-art mode for crisp scaling. |
| Language | **TypeScript** (strict) | Maintainability for release; leans on existing web skills; Phaser ships first-class types. |
| Build & dev server | **Vite** | Fast hot-reload dev server; one-command static build; familiar web tooling. |
| Package manager | **npm** | Familiar default (pnpm optional). |
| Unit testing | **Vitest** | Pairs natively with Vite; tests the pure game logic. |
| Lint / format | **ESLint + Prettier** | Keeps a release-grade codebase clean. |
| Level / path design | **Tiled** | Visual map editor → JSON that Phaser loads natively. |
| Pixel art | **Aseprite** (or free Piskel/LibreSprite) | Sprite + frame animation authoring/cleanup. |
| Audio | **Phaser WebAudio** + free CC0 SFX/music | No extra audio library needed. |
| Backend | **Supabase** (Postgres + Auth + Storage) | Auth, cloud save, leaderboards, asset storage in one managed service. |
| Backend client | **@supabase/supabase-js** | Official JS client. |
| Hosting | **itch.io** or **Netlify / Vercel** | Static deploy of the Vite build. |

No heavy client state library (Redux/Zustand): Phaser's built-in event emitter + a central game-state module is sufficient.

## 4. Architecture

**Core principle: separate the rules from the rendering.** Pure game logic (no Phaser imports) lives apart from the Phaser presentation layer, making the rules unit-testable and easy to reason about. We keep this pragmatic — *not* a full ECS.

```
bayani-td/
├─ index.html
├─ vite.config.ts · tsconfig.json · package.json
├─ .env                       # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (gitignored)
├─ public/assets/
│  ├─ sprites/                # heroes, enemies (aswang, tiktik), towers, projectiles
│  ├─ tilemaps/               # Tiled JSON + tilesets
│  ├─ audio/  └─ ui/
├─ src/
│  ├─ main.ts                 # Phaser game config + bootstrap
│  ├─ scenes/                 # Boot · Preload · MainMenu · Game · HUD · GameOver
│  ├─ game/                   # PURE LOGIC — no Phaser, fully unit-testable
│  │  ├─ config/              # data-driven content: heroes.ts, enemies.ts, waves.ts
│  │  ├─ systems/             # WaveManager · Economy · Targeting · Damage
│  │  ├─ entities/            # Tower, Enemy, Projectile (data + behavior)
│  │  └─ state/               # GameState (gold, lives, wave #)
│  ├─ objects/                # Phaser GameObjects that RENDER the game entities
│  ├─ services/               # backend layer (added in Phase 3): supabase.ts, auth.ts, leaderboard.ts, saves.ts
│  ├─ ui/                     # HUD widgets, buttons
│  └─ utils/
├─ supabase/                  # added in Phase 3: migrations/ (schema-as-code via Supabase CLI/MCP)
└─ tests/                     # Vitest tests for src/game
```

**Two principles to hold throughout:**

1. **Data-driven content** — heroes, enemies, and waves are plain data in `game/config/`. Adding a new hero or folklore enemy is editing a data file, not wiring new code. Essential for a roster that will grow.
2. **Logic ↔ presentation split** — `game/` owns the rules (damage, wave timing, targeting); `scenes/` + `objects/` own how it is drawn. `services/` is the *only* place that talks to the backend, keeping game logic backend-agnostic.

## 5. Asset Pipeline

| Need | Source | Tool |
|---|---|---|
| Baseline / placeholder art | Free CC0 kits — Kenney.nl, OpenGameArt, itch.io | drop straight in |
| Custom Filipino characters (heroes, aswang, tiktik) | Generate via **ChatGPT** (Browser MCP → logged-in tab) as first drafts | clean up + animate in **Aseprite** |
| Maps & enemy paths | Hand-designed | **Tiled** → JSON |
| Audio (SFX/music) | Free CC0 packs | Phaser WebAudio |
| Hosting custom assets | **Supabase Storage** bucket + core art bundled in build | — |

**Reality check:** AI-generated pixel art is rarely game-ready. It needs cleanup in Aseprite (consistent palette, clean edges, proper animation frames). ChatGPT is a *first-draft generator*, not a finished-sprite factory.

## 6. Supabase Backend (Phase 3)

Client uses `@supabase/supabase-js`; schema is managed as code in `supabase/migrations/` via the Supabase CLI + MCP.

| Table / bucket | Purpose | Row-Level Security |
|---|---|---|
| `profiles` | username + display data, 1:1 with `auth.users` | read all (for leaderboard names); update only your own row |
| `leaderboard_entries` | score, wave reached, map, timestamp | read all; insert only your own row (`user_id = auth.uid()`) |
| `saves` | per-player progress (unlocked heroes, level, settings) as JSON | read/write **only your own** row |
| Storage `game-assets` | sprites/audio/content served at runtime | public read; writes locked down to admin |

- **Auth:** Supabase Auth — email/password + Google sign-in. Prerequisite for cloud save and personalized leaderboards.
- **Env / security:** `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` are shipped to the client; this is safe **because** RLS guards the data. No service-role key in the client.
- **Anti-cheat caveat:** client-submitted scores are inherently spoofable. v1 uses RLS + basic validation. A hardened approach (Edge Function score validation, rate limits) is a deliberate later add, not a v1 requirement.

## 7. Build, Deploy & Quality

- **Vite** static build → deploy to **itch.io** or **Netlify / Vercel**.
- **Vitest** for the pure game logic in `src/game`.
- **ESLint + Prettier** enforced.
- Optional **GitHub Actions** CI: lint → test → build.

## 8. Phased Roadmap

Each phase is independently shippable. The aim is a playable game fast, with the backend layered on after the core loop is fun.

1. **Phase 0 — Scaffold:** Vite + Phaser + TS project; Boot/Preload scenes; render a Tiled map.
2. **Phase 1 — Core loop (playable!):** place towers, enemies walk the path, waves, gold economy, win/lose. Local save only — **no backend yet.**
3. **Phase 2 — Content:** hero roster + folklore enemy roster (aswang, tiktik, …), data-driven, real pixel art.
4. **Phase 3 — Supabase:** Auth → cloud save → leaderboards.
5. **Phase 4 — Polish:** asset storage, audio, particles, game-feel.

**The first implementation plan covers Phases 0–1.**

## 9. Tooling / MCP Setup (completed during design)

- **Browser MCP** (`@browsermcp/mcp`) added to project [.mcp.json](../../../.mcp.json). Activation requires: (1) reloading the Claude Code session to load + approve the server, and (2) installing the Browser MCP browser extension and connecting it to the logged-in ChatGPT tab. Used to generate first-draft sprites.
- **Supabase MCP** — already installed via the official Supabase plugin (hosted HTTP server). Requires one-time OAuth authentication to the user's Supabase account. Used to manage the database/migrations during Phase 3.

## 10. Out of Scope (for now) / Risks

- **Out of scope for v1:** native mobile/desktop apps; multiplayer; monetization/ads; hardened anti-cheat; a full content-management UI.
- **Risks:** (a) AI-generated pixel art needs manual cleanup — budget art time. (b) First-game scope creep — the phased roadmap is the mitigation. (c) Leaderboard cheating — accepted for v1, hardened later.
