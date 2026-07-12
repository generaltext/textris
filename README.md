# Textris

Tetris as a [General Text](https://www.generaltext.org) app, and the platform's first game. It's a standard modern Tetris with one twist: the high-score board is a set of plaintext files in the workspace, and every score is a **signed, replayable game** that any client re-simulates to verify. You can't fake a score by editing a number; you'd have to actually produce a game that plays that well.

This is the developer README (how it's built and how to work on it). The user-facing gallery description lives in [`public/gt-readme.md`](public/gt-readme.md).

## How it works

### A gt app has no backend

Textris is a static frontend. Its only backend is the platform's injected `window.gt` runtime (files, auth, sync). It never runs server code and never bundles a sync client or Yjs. See the app guide: https://www.generaltext.org/llms.txt (local source: `../../generaltext/content/docs/building-apps.md`).

### The deterministic engine is the whole trick

`src/engine/` is a pure, headless Tetris simulation with **no wall-clock time and no `Math.random`**. Randomness comes from a seeded PRNG (the 7-bag), and time advances in fixed 60 Hz logical frames. A game is therefore fully described by `{ seed, inputLog }`, and `simulate(seed, inputLog)` replays it to a bit-for-bit identical result on any machine.

That determinism is what makes the leaderboard trustworthy:

- The live game (`src/game/loop.ts`) records every input tagged with the exact frame it applied on.
- On game over, that log is encoded to a compact replay file, and a summary record (score, lines, etc.) is **signed** with the player's key.
- Any client loading the board **re-simulates the replay** and requires it to reproduce the claimed score. A tampered number simply won't reproduce.

### The unfakeable leaderboard

`src/board/` implements the trust model. To accept a score, a client checks all of:

1. **Signature** (ECDSA P-256, WebCrypto): the record is signed by the key its file claims, and the key hashes to the file's name.
2. **Replay integrity**: the stored replay hashes to the `replayHash` in the signed record.
3. **Reproduction**: `simulate(seed, decodedReplay)` reproduces the exact score / lines / level / frames.

Editing a score breaks (1); altering a replay breaks (2); a forged-but-signed higher score fails (3). The only way onto the board is to submit a real input log that genuinely achieves the score. A crude bot-input heuristic flags (but does not reject) inhuman input rates.

**Honest scope:** with no backend, identity is the player's key, not a verified account, and a determined bot could in principle generate a legitimate replay. What the design guarantees is that every score is a real, reproducible game, tamper-evident and independently checkable by anyone with the files. The player name is a display label (pulled from `gt.user()` when available, otherwise set manually); the `(you)` highlight tracks the key, not the name.

## Data layout

All under the app's own `data/` folder, addressed relative and versioned as `v0/`:

```
v0/identity.json            the player's signing keypair + display name
v0/scores/<pubkeyId>.jsonl  one signed record per game (you only ever write your own file)
v0/replays/<runId>.txt      the full replayable input log for each game
```

Record-per-writer (one score file per player) means concurrent players never contend under the CRDT. In a shared workspace, everyone's files sync in and every client verifies everyone else's, so it becomes a live shared leaderboard with no server keeping score.

## Project structure

```
src/
  engine/        pure, deterministic sim (no DOM, no clock, no Math.random)
    prng.ts        seeded PRNG (mulberry32)
    pieces.ts      tetromino shapes + SRS wall-kick tables
    board.ts       grid ops (collision, lock, line clear, 7-bag)
    engine.ts      the reducer: DAS/ARR, gravity, lock delay, scoring
    simulate.ts    headless replay -> result; step-through for the viewer
    replay.ts      compact input-log encode/decode
    *.test.ts      determinism + "live play == replay" invariants
  game/          the only non-pure layer (canvas + input + loop)
    loop.ts        fixed-timestep RAF loop; records the input log
    input.ts       keyboard -> actions
    render.ts      canvas drawing (board, ghost, hold, next)
    Game.tsx       playable board, HUD, touch controls, fit-to-width scaling
    ReplayViewer.tsx  watch any run, with a scrubber
  board/         the leaderboard + trust model
    identity.ts    keypair gen/load, display name
    sign.ts        canonical serialize, sign, verify (ECDSA P-256)
    records.ts     record types, daily seed, submit (write replay + append record)
    verify.ts      signature + hash + re-simulation checks
    use-leaderboard.ts  live subscription + background verification
    Leaderboard.tsx     the board UI
    roundtrip.test.ts   end-to-end: genuine run verifies; every cheat is caught
  lib/
    use-theme.ts     follow the shell's light/dark theme
    demo-runtime.ts  in-browser window.gt stand-in for the standalone /demo
    dev-seed.ts      seed the "Try it live" demo with real verifiable bot runs
  App.tsx          menu, name editing, mode select, leaderboard
  main.tsx         entry; installs the demo runtime on /demo when outside GT
public/
  gt.json          manifest (name, version, gtApi, icon, tags)
  gt-readme.md     user-facing gallery description
  _headers         CORS for install-from-URL (Cloudflare)
```

## Develop

Requires Node 24+ and pnpm.

```bash
pnpm install
pnpm dev        # standalone: injects the platform runtime, runs a local
                # in-browser workspace (IndexedDB + cross-tab sync)
pnpm test       # vitest: engine determinism + leaderboard round-trip
pnpm build      # tsc + vite build -> dist/
pnpm preview    # serve the production build
pnpm lint       # oxlint
```

In `pnpm dev` the app runs on its own with a local workspace, so there's no need to run General Text. Open two tabs to watch sync merge. To point at a locally running platform instead of prod, set `GT_ORIGIN` (e.g. `GT_ORIGIN=http://localhost:5173 pnpm dev`). Visiting `/demo` (or the "Play the demo" button when opened outside GT) runs a self-contained in-browser runtime with sample scores.

### Testing note

The engine is where correctness lives, so it carries the tests:

- **Determinism**: same `seed` + input log always yields the same result.
- **Live == replay**: driving the engine frame by frame (as the game loop does) reproduces exactly what `simulate()` derives from the recorded log.
- **Trust model** (`board/roundtrip.test.ts`): a genuine run verifies, while an edited score, a tampered replay, a forged-and-re-signed score, and a wrong-file placement are all rejected.

## Build and deploy

`pnpm build` outputs a static site to `dist/` with a relative base, so it works from any serving root. Two ways to ship:

- **Install by URL**: serve `dist/` anywhere that sends `Access-Control-Allow-Origin: *` (the included `public/_headers` does this on Cloudflare), then use *Settings -> Apps -> Install by URL* in a workspace.
- **Cloudflare**: `wrangler deploy` (assets-only Worker; config in `wrangler.jsonc`).

The manifest (`public/gt.json`) is the source of truth for the gallery listing (name, version, icon, tags). Bump the `version` major only on a breaking change to the data format; data is versioned under `data/v{major}/` and the app migrates its own data across majors.
