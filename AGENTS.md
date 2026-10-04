# AGENTS.md: fcf_sonnet (2048)

A browser-first, installable (PWA) 2048 game. Goal: best in class in feel, correctness,
accessibility, and performance. No shortcuts. If something is hard, do it properly or
ask the owner. Do not stub it.

Live: https://puzlgame.vercel.app (Vercel, auto-deploys `main`)
Repo: github.com/shouryaaggarwal9/fcf_sonnet_2048

## Verification status of this document

The original version of this file was written by an assistant that could not run the code, and
it said so. That is no longer true: the game has been built out through roadmap Phase 8, every
claim below has been checked against a real run, and CI enforces all of it on every push. Treat
this file as accurate as of Phase 8. If the code and this file disagree, the code still wins, and
fix this file in the same change.

**Still not machine-verifiable, and honest about it:** animation feel, swipe rhythm, and anything
else the owner judges by eye on a real device. Also unverified: offline play in real Safari (see
Phase 8 in the roadmap), because Playwright's WebKit cannot survive an offline reload.

## Stack (actual, as built)

TypeScript (strict, plus `noUncheckedIndexedAccess`), Vite 8, React, Zustand, Vitest 5,
Biome (exact-pinned) for lint and format, pnpm (pinned via `packageManager`), Playwright 1.63
for end-to-end, `@axe-core/playwright`, `@lhci/cli` for Lighthouse CI, `vite-plugin-pwa`,
GitHub Actions CI, Vercel hosting. **Plain CSS with CSS variables.** Tailwind and the Motion
library were considered and deliberately not used. Do not add either without asking.

Vite, Vitest, Biome, Playwright, and Lighthouse are recent major versions. Read their current
docs before using config or plugin APIs. Do not rely on memory. This has already bitten once:
Lighthouse removed the PWA category and its individual audits, so the roadmap's "plus PWA
checks" could not be done the way it was written.

## Commands

```
pnpm dev          # dev server
pnpm test         # vitest run (500 tests / 30 files, ~40s; fuzz dominates)
pnpm lint         # biome check .   (lint:fix to autofix)
pnpm typecheck    # tsc -b   (app + node + e2e, see tsconfig.e2e.json)
pnpm build        # tsc -b && vite build
pnpm preview      # vite preview

pnpm e2e          # playwright test, 111 tests over chromium/webkit/mobile-chrome (~5min)
pnpm e2e:install  # download the browsers (once; ~500MB)
pnpm e2e:ui       # playwright --ui
pnpm bundle       # fail if dist/assets exceeds the gzip budget
pnpm lighthouse   # lhci autorun; needs a local Chrome
pnpm icons        # regenerate public/ icons from icon-source.svg
pnpm csp          # recompute the inline-script hash and write it into vercel.json
```

**Definition of done for every change:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
all pass, and CI is green after push. If the change touches rendering, dialogs, input, or
anything a browser has to agree on, `pnpm e2e` must pass too — it is the only gate that runs
WebKit, and three real bugs got past everything else by only existing there.

Baseline at Phase 9: **500 unit and component tests in 30 files**, 159 e2e tests (157 passing,
2 skipped), 77.3 kB JS and 3.2 kB CSS gzipped against budgets of 100 and 12. Unit counts may
only go up. If one goes down, explain why in the commit message.

### What each gate is for

They overlap on purpose, because each catches something the others cannot.

- `pnpm test` — logic, fast, no browser.
- `pnpm typecheck` — includes `e2e/`, with the same `strict` and `noUncheckedIndexedAccess` as
  the app. Adding it caught five real type errors in the e2e suite on the day it was written.
- `pnpm bundle` — deterministic. The real budget, and the gate that will actually stop a
  dependency adding weight.
- `pnpm e2e` — the only gate that runs WebKit and a touch viewport. Also the only place axe
  runs, in both themes.
- `pnpm lighthouse` — scores only, currently 96–98 Performance and 100 for Accessibility, Best
  Practices, and SEO. It is a smoke test with about a point of headroom on Performance, so it
  can go red on a busy runner. Do not treat a red score as the truth; check `pnpm bundle` and
  `pnpm e2e` first.

Note what Lighthouse no longer checks: there is no PWA category and no `installable-manifest`,
`service-worker`, `maskable-icon`, or `tap-targets` audit. PWA behaviour is asserted in `e2e/`
instead, which can actually test it.

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

### Persistence and seeds (`src/state/savedData.ts`, `src/state/seed.ts`)

- `SCHEMA_VERSION` is 4. Any change to the persisted shape needs a bump **and** a branch in
  `migrate()`. Validation is hand-written and must never throw: corrupt, missing, or
  newer-version data falls back to a fresh game.
- `?seed=123` in the URL starts that exact game, because the engine is deterministic. It is
  validated strictly — whole numbers only, coerced with `| 0` to match the engine — and
  anything else is ignored rather than guessed at.
- **The seed applies only when there is nothing saved.** This is deliberate and was a real bug
  once: letting the seed always win still wrote moves to storage, so progress was saved and
  then never read, and every reload silently discarded the game. If you add a daily challenge
  or any other seeded mode, **give it its own storage key** so it cannot collide with ordinary
  play. That is the whole reason for the rule.
- Storage is resolved once and lazily; a throwing or missing `localStorage` yields null and
  every write is skipped. The game must run identically with storage unavailable.

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

### Testing animation timing (`e2e/timing.spec.ts`)

Timing bugs never show up in a unit test and only reproduce on a device. Two hard-won rules if you
extend that suite:

- **Never poll for a live animation from outside the browser.** A merge pop lives ~330ms, and a
  Playwright round trip does not reliably fit inside that when the suite runs in parallel. It
  failed about one run in three, and far more on WebKit than Chromium. The suite records
  `animationstart` *inside* the page and reads the log after, so nothing can be missed.
- **Never wait for `getAnimations().length === 0`.** A ghost fades with `fill-mode: forwards`, so
  its effect persists and it stays in that list forever. Wait on `playState === 'finished'`.

Both cost real time to find, and both fail in the direction of proving nothing. When you add an
assertion here, break the CSS deliberately afterwards and confirm the test goes red — a timing
test that cannot fail is worse than no test.

### Input

All sources (keyboard, swipe, on-screen buttons) go through `gameInput.input` (`ui/gameInput.ts`),
which wraps `createMoveController` (`ui/moveController.ts`): a lock equal to one slide plus a
queue of 2 (extras dropped, no-op moves skipped without consuming lock time, `reset()` on
new game). Keyboard uses `event.code` (WASD stays physical), ignores Ctrl/Meta/Alt, key repeat,
IME composition, and typing targets. Swipe uses Pointer Events (24px threshold, one move per
gesture, dominant axis, `touch-action: none`, ignores buttons inside the swipe area).

**Anything that replaces the game must call `gameInput.reset()` first**, or queued moves from
the old game leak into the new one.

### Dialogs and focus (`src/ui/Modal.tsx`, `GameOverlay.tsx`, `useModalDialog.ts`, `useOverlayFocus.ts`)

There are two focus hooks and they are deliberately not shared, because the two overlays are
different mechanisms:

- `Modal` is a **native `<dialog>`**, driven by `useModalDialog`.
- `GameOverlay` is a `div[role="dialog"]`, driven by `useOverlayFocus`. There is no
  `showModal()` to call, so the two cannot be one hook.

**Do not "simplify" these into one hook without reading this first.** Both orderings in
`useModalDialog` are load-bearing, and both were wrong in the version that shipped:

- Capture the opener **before** `showModal()`. showModal moves focus, so capturing afterwards
  stores the close button and closing returns focus to a button inside a dialog that is no
  longer open.
- Restore focus on the **`close` event**, not on a state change. Restoring earlier gets bounced
  back into the dialog by the browser and then lost when it closes.

This whole area was broken in **Safari only** and invisible in Chromium, which restores focus
for you natively. Anything about dialogs, focus, or `aria-modal` must be checked on WebKit, and
driven by **keyboard**, because WebKit blurs a button on `mousedown` (Safari does not focus
buttons on click), so with a mouse the opener genuinely is `<body>` and there is nothing to
restore to. That is correct behaviour, not a bug.

The 44px minimum tap target is enforced in CSS on `.btn`, `.btn-sm`, and `.settings-option`.
The text buttons were 37px before Phase 8 and the e2e suite caught it.

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
  The two existing `as CSSProperties` casts for CSS custom properties are accepted. Under
  `noUncheckedIndexedAccess`, prefer `?? fallback` with a comment over a cast.
- Accessibility is a requirement, not polish. Everything interactive is keyboard and screen-reader usable.
- State shape changes to anything persisted require a schema version bump and a migration.
- There is deliberately **no pre-commit hook** (owner decision, Phase 8). It needs a `prepare`
  step that can silently not run, it only sees staged files so it is weaker than the full
  `pnpm lint` that CI already runs on every push, and it would add a dependency. Do not add one
  without asking.
- If a test needs a deliberately slow timeout, state it on that one test with the reason, rather
  than raising the global timeout. `tileTracker.test.ts` is the current example.

## How to work with the owner

- The owner verifies feel (animation, swipe, rhythm) **by eye on real devices**. You cannot judge
  that. Make timing easy to tune (constants in `motion.ts`) and ask for a visual check at the end
  of every UI task, saying exactly what to look at.
- You can and should verify behavior with Playwright screenshots, traces, and the DevTools
  Animations panel. Do that instead of guessing. One limit worth knowing: CSS animations cannot
  advance in a backgrounded tab, so anything about smoothness has to be checked by the owner.
- The owner is happy to decide things the agent shouldn't (branding, product choices). Ask a
  short, specific question with your recommendation. Don't block on small matters. Pick the
  option that polished tile games use, and say what you picked.
- Work the roadmap in `docs/ROADMAP.md` in order, one task at a time. Update its checkboxes
  as you finish tasks, **including the ones already satisfied by earlier work** — several were
  left unticked for phases that shipped, and a checklist that under-reports progress is worse
  than no checklist.

## Deployment

Vercel, linked to this repo, auto-deploys `main`. **Pushing to `main` publishes to
https://puzlgame.vercel.app**, so a green local gate is not optional there. CI runs three jobs on
every push and pull request: lint/types/unit/build/bundle, end-to-end, and Lighthouse.

`vercel.json` holds the security headers and cache rules, and three things about it are load-bearing:

- **`sw.js` and the Workbox runtime must stay `must-revalidate`.** Get this wrong and returning
  clients pin an old service worker, which is the classic way a PWA keeps serving an old build
  after you fixed it. This is the rule to check first when production looks stale.
- **The CSP allows exactly one inline script, by hash** — the theme boot script in `index.html`,
  which must be inline or the page paints light and snaps to dark. If you change that script, run
  `pnpm build && pnpm csp` and commit the updated `vercel.json`; `src/state/security.test.ts` fails
  if they disagree. The hash is computed from `dist/index.html`, not the source, because Vite
  rewrites what it emits.
- **`vite preview` serves those headers during `pnpm e2e`**, so the suite runs under the real
  policy. Keep it that way. A CSP that is only ever deployed is a CSP that is never tested, and the
  failure is silent: the theme quietly stops applying and the console fills with violations.

Not yet done: nothing deployment-related. The owner has confirmed `puzlgame.vercel.app` is
sufficient, so there is no custom domain and no `rel="canonical"` to add. The one item still
waiting on the owner is `LICENSE`, which means all rights reserved until they choose.

## Accepted accessibility tradeoff

Pinch-zoom is disabled, by the owner's decision: the game has nothing to magnify, and a zoomed page
turns the next swipe into browser back/forward navigation.

This fails WCAG 1.4.4, and **two tools report it**: axe's `meta-viewport` and Lighthouse's
`meta-viewport`, which cost 7 points of the accessibility score on its own. Both exemptions are
named explicitly rather than applied as blanket rule-disables, so every other rule stays enforced,
and `src/state/security.test.ts` asserts the Lighthouse exemption exists exactly while zoom is
disabled. If you re-enable zoom, remove both exemptions in the same change or they will rot
silently.
