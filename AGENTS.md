# AGENTS.md: fcf_sonnet (2048)

A browser-first, installable (PWA) 2048 game. Goal: best in class in feel, correctness,
accessibility, and performance. No shortcuts. If something is hard, do it properly or
ask the owner. Do not stub it.

Live: https://puzlgame.vercel.app (Vercel, auto-deploys `main`)
Repo: github.com/shouryaaggarwal9/fcf_sonnet_2048

## Verification status of this document

This file was written by a previous assistant that could not run the code. It reflects what
the owner reported (test output, CI, screenshots), not independent verification. Treat
claims here as strong hints. Confirm against the code before relying on them. If the code
and this file disagree, the code wins. Then fix this file.

## Stack (actual, as built)

TypeScript (strict, plus `noUncheckedIndexedAccess`), Vite 8, React, Zustand, Vitest 5,
Biome (exact-pinned) for lint and format, pnpm (pinned via `packageManager`), GitHub Actions CI,
Vercel hosting. **Plain CSS with CSS variables.** Tailwind and the Motion library were
considered and deliberately not used. Do not add either without asking.

Vite, Vitest, and Biome are recent major versions. Read their current docs before using
config or plugin APIs. Do not rely on memory.

## Commands

```
pnpm dev          # dev server
pnpm test         # vitest run (~11s, fuzz tests dominate)
pnpm lint         # biome check .   (lint:fix to autofix)
pnpm typecheck    # tsc -b
pnpm build        # tsc -b && vite build
```

**Definition of done for every change:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
all pass, and CI is green after push. Baseline when this was written: 216 tests in 14 files.
The count may only go up. If it goes down, explain why in the commit message.

## Architecture: the one-way dependency rule

```
src/ui  ->  src/state  ->  src/engine
```

- `src/engine`: pure, deterministic game logic. **Must never import React, touch the DOM,
  use `Math.random`, `Date`, or storage.** `purity.test.ts` enforces this by scanning
  source. Do not weaken that test. The only public surface is `src/engine/index.ts`. UI and
  state import from `'../engine'`, never from `'../engine/move'`, etc.
- `src/state`: Zustand store (`gameStore.ts`) and the tile tracker. No imports from `ui`.
- `src/ui`: components, hooks, CSS, motion constants. Talks to the game only through the store
  and `gameInput`.

### Engine facts you must preserve

- `GameState` is plain JSON: `board, score, moves, status('playing'|'won'|'over'), keepPlaying,
seed, rngState`. Every function is pure and never mutates. A rejected move returns the
  **same state object** (`===`), and the store relies on that to skip re-renders.
- RNG is mulberry32. The whole generator state is one int (`rngState`). The same seed plus the same
  moves always gives the same game. RNG call order in `spawnTile` is a contract (1st call picks
  the cell, 2nd picks the value). A full board consumes no randomness.
- `applyMove` returns `{state, moved, gained, spawned, moves}`. `moves` is the per-tile trace
  (`TileMove`: from, to, value, merged). Merge partners share a destination.
- Moves are rejected while status is `won` or `over`. `continueGame` handles the post-win choice.
- Engine supports any square size (3 to 8 intended). The UI has only been run at 4x4.

### Tile tracker (`src/state/tileTracker.ts`)

Gives tiles stable IDs so CSS can animate them. Holds `tiles`, `ghosts` (merge partners that
finish sliding then vanish), and `nextId`.

- Tile `birth` (`initial | fresh | spawn | merge`) is **immutable for a tile's life**, so its
  entrance animation plays exactly once.
- `drawOrder()` returns tiles plus ghosts **sorted by ascending id**. New tiles only ever get
  higher ids. **Never reorder DOM nodes.** Browsers cancel running transitions when a node moves.
- IDs are never reused, including across new games (`nextId` carries over).
- `syncTracker` rebuilds if the tracker doesn't match the board (used when state is replaced
  from outside). Rebuilds use `birth: 'initial'` (no animation).
- The tracker is not part of `GameState`. Anything that replaces `game` (undo, restore,
  restart) **must also replace `tracker` consistently**.

### Animation system (`src/ui/Board.css`, `src/ui/motion.ts`)

- `motion.ts` is the **single source of truth** for timing (`SLIDE_MS=150`, ease
  `cubic-bezier(0.33,1,0.68,1)`, `SPAWN_MS=180`, `POP_MS=200`). It exposes them to CSS as
  custom properties on `.board`. The move lock uses the same `SLIDE_MS`. Never hard-code a
  duplicate number in CSS or elsewhere.
- Principles (owner-approved, imitate polished tile games): logic is instant and animation is only a view;
  tiles slide first, and spawn and merge effects start exactly when the slide ends
  (CSS `animation-delay: var(--slide-ms)` with `fill-mode: backwards`, no timers); only
  `transform` and `opacity` are animated; position lives on `.tile` (outer) and scale and
  fade live on `.tile-inner`; merged tiles sit above ghosts (z-index); ghosts fade on the
  **outer** element so they never fight the inner entrance animation.
- `prefers-reduced-motion`: no sliding or scaling, only short opacity fades.

### Input

All sources (keyboard, swipe, on-screen buttons) go through `gameInput.input` (`ui/gameInput.ts`),
which wraps `createMoveController` (`ui/moveController.ts`): a lock equal to one slide plus a
queue of 2 (extras dropped, no-op moves skipped without consuming lock time, `reset()` on
new game). Keyboard uses `event.code` (WASD stays physical), ignores Ctrl/Meta/Alt, key repeat,
IME composition, and typing targets. Swipe uses Pointer Events (24px threshold, one move per
gesture, dominant axis, `touch-action: none`, ignores buttons inside the swipe area).

**Anything that replaces the game must call `gameInput.reset()` first**, or queued moves from
the old game leak into the new one.

## Conventions

- Test-first for logic. Hand-worked expected values, not copied from implementation output.
  Pure functions with injected dependencies (see `moveController`, `keyToDirection`).
- Conventional commits (`feat(scope):`, `fix:`, `chore:`, `test:`, `docs:`). One logical change
  per commit. Push after green checks.
- Biome formats and lints. Do not disable a rule to make a warning go away without a
  one-line justification comment. Formatting differences between machines are why Biome is pinned.
- `.gitattributes` should contain `* text=auto eol=lf` (owner is on Windows). Add it if missing.
- No new dependency without checking: maintained, size impact (`pnpm build` output), license, need.
  Prefer platform features.
- Never use `any`, non-null `!`, or `as` casts to silence the compiler unless justified in a comment.
  The two existing `as CSSProperties` casts for CSS custom properties are accepted.
- Accessibility is a requirement, not polish. Everything interactive is keyboard and screen-reader usable.
- State shape changes to anything persisted require a schema version bump and a migration.

## How to work with the owner

- The owner verifies feel (animation, swipe, rhythm) **by eye on real devices**. You cannot judge
  that. Make timing easy to tune (constants in `motion.ts`) and ask for a visual check at the end
  of every UI task, saying exactly what to look at.
- You can and should verify behavior with Playwright screenshots, traces, and the DevTools
  Animations panel. Do that instead of guessing.
- The owner is happy to decide things the agent shouldn't (branding, product choices). Ask a
  short, specific question with your recommendation. Don't block on small matters. Pick the
  option that polished tile games use, and say what you picked.
- Work the roadmap in `docs/ROADMAP.md` in order, one task at a time. Update its checkboxes
  as you finish tasks.
