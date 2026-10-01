# Roadmap

Work top to bottom. Each task has acceptance criteria. A task isn't done until every
criterion holds and the Definition of Done in AGENTS.md passes. Tick the box in this file
in the same commit.

## Current state (completed)

- [x] Phase 0: Vite + React + TS strict, Biome, Vitest, CI, Vercel deploy
- [x] Phase 1: engine (slide, move, spawn, seeded RNG, game state, win/over, fuzz and purity tests)
- [x] Phase 2: store, board and tile rendering, score boxes, win and game-over overlays
- [x] Phase 3: keyboard, swipe (verified on a real phone), move lock and queue
- [x] Phase 4 (partial): tile tracker, slide, spawn, merge pop, ghost hand-off, queue-safe CSS

Known temporary things to remove or replace:

- On-screen `up/left/down/right` "dev controls" in `App.tsx` and `.dev-controls` in `App.css`
- Header text, `<title>`, and favicon are placeholders
- Keyboard focus stays on the header button when the overlay appears

Fixed since this list was written: `Best` score box (5.1), and the overlay no longer appears
instantly (4.5). The overlay is still not a dialog and does not take focus, which is Phase 6.

---

## Phase 4 (finish): animation completion

### 4.5 Overlay timing, score gain popup, reduced-motion audit

- [x] **Delayed overlay.** The win and game-over overlay fades in only after the last move's animations
      finish (delay of `SLIDE_MS + max(SPAWN_MS, POP_MS)`, derived from `motion.ts`, not a new magic number).
      Players must see the final board first. `backwards` fill so it's invisible while waiting. It must
      not be clickable or focusable before it's visible. Reduced motion: a short fade with no long delay.
- [x] **Floating "+N".** On each accepted move with `gained > 0`, a "+N" rises and fades from the Score box.
      Key it by `game.moves` so each instance is independent. Starts when the slide ends, like merge
      effects. Clean up on `animationend`. `pointer-events: none` and `aria-hidden`. Overlapping
      instances from queued moves must not break. Reduced motion: fade only, no travel.
      Optionally give the Score box a tiny bump on change.
- [x] **Reduced-motion audit.** Walk every animation and transition. Each has a reduced variant that removes
      movement and scaling. No parallax or large motion is left. Check with DevTools emulation.
- [x] Unit-test any new pure logic (for example the delay calculation).

### 4.6 Tuning and edge cases

- [ ] Review durations on a real phone with the owner. Adjust only in `motion.ts`. The owner already
      felt 110ms and a quint ease was too fast. 150ms with an ease-out cubic is the current choice.
- [ ] Profile on a throttled CPU (DevTools 6x slowdown): sliding stays smooth. If `container-type: size` on every
      tile or `backdrop-filter` on the overlay causes cost, measure and fix it. Don't guess.
- [ ] Verify these explicitly and add Playwright tests later in Phase 8 for the ones that can be automated:
      mash keys (queue of 2, lock honoured); new game mid-animation; tab hidden and restored mid-animation;
      window resize mid-slide; `[2,2,2,2]` gives two simultaneous pops; merge plus spawn at the same instant;
      page load shows no animation.
- [x] Touch polish: `overscroll-behavior: none` on the page, no long-press context menu or text selection
      on the board, no double-tap zoom (`touch-action: manipulation` outside the swipe area).

---

## Phase 5: core features

### 5.1 Persistence and best score (do this BEFORE undo and theme, both depend on it)

- [x] Create `src/state/persistence.ts`: a versioned envelope `{ version, data }` in `localStorage`.
      Hand-written runtime validation (or a small schema lib if justified) for everything read back:
      board is square with valid tile values (0 or powers of 2 >= 2), `rngState` and `seed` are
      finite ints, `status` is valid, and so on. Corrupt, missing, or newer-version data falls back to a fresh
      game and never throws. Provide a migration function even if there is only v1.
- [x] All storage access wrapped in try/catch (private mode, quota, disabled storage). The game must
      run with storage unavailable.
- [x] Persist: current game and its tracker-independent state, best score, settings (theme, etc.).
      On load, rebuild the tracker from the board with `birth: 'initial'` (no animation).
- [x] Debounce or batch writes. Write on accepted moves and on `visibilitychange` and `pagehide`
      (not every render). Make sure a hard kill loses at most the last move.
- [x] **Best score:** never decreases. Updated when score exceeds it, including after a win and continue.
      Show a `Best` ScoreBox. Best is **per board size** (prepare for Phase 10 variable sizes).
- [x] Multi-tab: listen to the `storage` event so best score stays consistent. Decide, document,
      and test what happens if two tabs play (recommended: last-writer-wins for the game, max for best).
- [x] Tests: round-trip, corrupt JSON, wrong version, tampered board, storage throwing, restore continues
      identically to the original game (determinism through `rngState`).

Decisions and things later phases must not undo:

- Validation lives in `src/state/savedData.ts` (pure, over `unknown`); storage I/O lives in
  `src/state/persistence.ts`. Split so validation is testable without a DOM.
- **Game and best share one key.** One write is atomic and cannot half-apply. The cost is that
  rejecting a corrupt game also loses the best score. Deliberate: a save that half-applies and
  shows a wrong board is worse than a lost high score.
- `migrate()` has one branch today. Each new shape adds a branch rather than editing the
  validator above it, so old saves keep working.
- `store.adopt()` is the single path for replacing the game from outside (load, another tab). It
  always rebuilds the tracker with `birth: 'initial'` and carries `nextId` forward, so a restored
  board never animates in and never reuses a DOM node.
- Writes are debounced 400ms and flushed on `visibilitychange`/`pagehide`. Nothing is written on
  load, so a save we just rejected is not immediately rewritten with the fresh game.
- Theme is persisted as `settings.theme` but fixed to `system` until 5.3.
- 5.2 must not store history inside `GameState`; it goes beside the tracker in the store, and 5.2
  adds it to the envelope, which means a schema version bump.

### 5.2 Undo (owner-requested)

Design is decided. Implement it as specified.

- [x] **What a snapshot is:** taken immediately before each accepted move. See the deviation note
      below: it is `{ game: GameState }`, not `{ game, tracker }`.
- [x] **History:** a stack in the store (not in the engine, which stays free of history). Cap at a
      sensible depth (recommend 50) and drop the oldest. `undo()` pops and restores both `game` and `tracker`.
      Cleared on new game and restart.
- [x] **Restoring state:** after `undo`, `moves` and `score` go back to their earlier values (they live in
      `GameState`). **Best score must not decrease.** Undoing from `won` or `over` returns to `playing` and
      re-evaluates correctly. Undoing a move that crossed the win threshold with `keepPlaying`
      restores the `keepPlaying` flag exactly.
- [x] **RNG consequence (document in code):** restoring `rngState` means that replaying the _same_ direction
      yields the _same_ spawn, while a different direction yields different outcomes. This is deterministic
      and honest. Do not silently reseed. Mention it in the README as a deliberate choice. Record an
      `undos` counter in the persisted state so a future daily challenge can show or limit it. Do not
      decide limits now.
- [x] **Input interaction:** `undo` calls `gameInput.reset()` (drops queued moves and the lock), then applies.
      It must be safe to call mid-animation: ghosts and in-flight tiles must not leave visual debris.
      Restore with a tracker whose tiles are `birth: 'initial'` and no ghosts, and have the board show a
      short crossfade (opacity only, about 120ms) so the change doesn't read as a glitch. Do not try to
      run slides backwards. Ask the owner to look at it and be ready to iterate.
- [x] **UI:** an Undo button in the action row with an icon plus an accessible label, `disabled` when
      history is empty (and `aria-disabled` semantics checked), showing no confusing count. Shortcut:
      `Ctrl/Cmd+Z` and `U`. Extend `keyToDirection`'s caller, not the direction map, and keep the "ignore
      while typing" rule. No shortcut fires on key repeat.
- [x] **Persistence:** history persists across reloads (capped, for example 20, to bound storage). Include it in the
      schema version.
- [x] **Tests:** undo restores exact previous `game` (`toEqual`) and a tracker that `matchesBoard`; undo
      twice; undo to start; undo when empty is a no-op that returns false; undo after game over and
      after win; undo then move equals the original line if the same direction is played; history
      cap; history cleared on restart; fuzz: random sequences of move and undo never break
      tracker or board invariants, and `sum` of tiles is conserved; best score survives undo.
- [ ] A Playwright test (Phase 8) for undo via button and via keyboard.

Decisions and things later phases must not undo:

- **Schema is now v2.** v1 saved no history. `migrate()` has a v1 branch that keeps the game and
  best and restores an empty history, so an existing v1 save upgrades in place.
- **Deviation from the snapshot spec above, deliberate.** It says a snapshot must carry
  `TrackerState` too, because tile IDs are not in `GameState`. It is stored as `{ game }` only.
  A snapshot's tracker is always in step with its board, and undo normalises every birth to
  `initial`, which is exactly what rebuilding from the board produces. Ids are reissued from the
  live `nextId` on restore, so no DOM node is reused and no tile can slide from a stale position.
  Storing the tracker would double the saved payload for no behavioural difference.
- Depth is 50 in session (`HISTORY_CAP`) and 20 in storage (`PERSISTED_HISTORY_CAP`), so a
  reload leaves the last 20 moves undoable. The owner was offered a 1-deep undo to cut the work;
  it was declined because the cap is one constant and everything else is identical either way.
- **The input reset is the load-bearing part of undo.** `requestUndo()` in `ui/useUndo.ts` calls
  `gameInput.reset()` before `store.undo()`. Without it a move queued for the state being left
  fires immediately after and undoes the undo. `state` must not import `gameInput`, so that file
  is the seam.
- **`store.boardEpoch`** is bumped by undo and by `adopt`. The board keys its tile layer on it, so
  a replacement remounts the tiles (no stale positions) and crossfades. Ordinary slides never
  change it, so they are untouched.
- `isUndoKey` sits in `ui/input.ts` beside `keyToDirection` but is a separate function. It cannot
  live in the direction map: `keyToDirection` rejects every modified key, which would make
  `Ctrl+Z` impossible. A test asserts no key triggers both.
- `restart` clears history but keeps `best`. `adopt` takes the other tab's history, since that
  game's history no longer describes this board.

### 5.3 Theme toggle: system / light / dark (owner-requested)

Current theming uses `@media (prefers-color-scheme: dark)` blocks in `src/index.css` and
`src/ui/Board.css` (including tile tier 1 and 2 dark variants). This must be refactored so the
user's choice can override the system.

- [ ] **Three states:** `system` (default), `light`, `dark`. Persisted in settings (5.1). Apply by
      setting `data-theme="light|dark"` on `<html>`. In `system` mode, resolve through `matchMedia` and
      **live-update** when the OS setting changes (listener cleaned up properly).
- [ ] **Refactor CSS:** all colors live in CSS custom properties defined once for light and once
      for dark under `:root[data-theme="light"]` / `:root[data-theme="dark"]`. No remaining
      `prefers-color-scheme` media queries for colors except the single place that resolves `system`
      (or resolve it in JS and always set `data-theme`). Set `color-scheme` per theme so native
      controls and scrollbars match. Tile palettes move to variables, not duplicated selectors.
- [ ] **No flash of wrong theme:** a tiny inline script in `index.html` `<head>` reads the stored setting
      and sets `data-theme` before first paint. It must be try/catch-safe. **Note for Phase 9:** an inline
      script requires a CSP hash or nonce. Plan the CSP accordingly. Do not use `unsafe-inline`.
- [ ] **`<meta name="theme-color">`** updates with the resolved theme (and later feeds the PWA manifest).
- [ ] **Toggle UI:** an accessible control in the header. Recommended: a single icon button cycling
      system, light, dark, with `aria-label` stating the current mode and the next action (or a
      3-option radio group in a settings popover). Icon changes per mode. Minimum 44x44px target.
      Keyboard operable, visible focus, announces changes.
- [ ] **Overlay and score colors** also come from variables. Check every component in both themes.
- [ ] **Contrast audit (both themes):** verify WCAG AA for all tile text and UI text. The classic palette's
      light text on yellow tiles (tiers 7 to 11) is **known to be low contrast**. Compute ratios, then adjust
      colors or text colors so every tier passes at least 4.5:1 for numbers (3:1 minimum for large text if
      you argue it's large, and document it). Keep tiers visually distinct.
- [ ] Tests: theme resolution function (pure, with injected `matchMedia` result), cycling order, storage
      fallback. Playwright (Phase 8): toggling changes `data-theme`, persists across reload, and `system`
      follows `emulateMedia`.

### 5.4 New game and restart behavior

- [ ] "New game" on a game in progress (`moves > 0` and status `playing`) asks for confirmation
      through an accessible modal (`<dialog>` with focus trapping and Escape handling). No confirm on
      fresh or over states. Make the confirm copy mention that undo is not available after restart.
- [ ] Both restart paths call `gameInput.reset()` first (already true in `handleRestart`. Keep it).

### 5.5 Remove the dev controls (and replace them properly)

- [ ] Delete the temporary direction buttons and `.dev-controls`.
- [ ] **WCAG 2.5.1 (pointer gestures):** swipe is a path-based gesture, so offer a single-tap alternative.
      Add an optional on-screen D-pad, toggled in settings and off by default, wired through `gameInput`.
      Keyboard users are already served.

---

## Phase 6: polish and accessibility

- [ ] **Layout:** responsive from 320px to desktop, portrait and landscape phones (the current board width
      `min(92vw, 60dvh, 480px)` is a starting point). Safe-area insets (`env(safe-area-inset-*)`) for
      notched phones and standalone PWA. Test landscape specifically.
- [ ] **Screen readers:** a visually hidden `aria-live="polite"` region announcing meaningful events only
      (for example "Merged to 128. Score 1,456." and "Game over"), not every tile. Board has an
      accessible name and a short instructions text. Ghost tiles remain `aria-hidden`. Overlays are
      dialogs.
- [ ] **Focus management:** when the win or game-over overlay appears, move focus to its primary button and
      restore it afterwards. Known issue: focus currently stays on the header button.
- [ ] **Keyboard:** visible `:focus-visible` everywhere. Logical tab order. Document shortcuts in a
      How-to-play dialog (rules, controls, undo shortcut).
- [ ] **Settings dialog:** theme, on-screen D-pad, reduced-motion override (respect system by default),
      sound and haptics toggles if implemented.
- [ ] **Sound and haptics (optional):** `navigator.vibrate` for merges where supported, short
      Web Audio blips. Off by default or at least obviously mutable. Respect user gesture rules for audio.
      Check that it adds negligible weight.
- [ ] **Branding:** product name, favicon, header, and metadata (see "Owner decisions"). Open Graph and Twitter
      card image, `<meta name="description">`, `lang`, canonical URL.
- [ ] **Component tests:** add jsdom and `@testing-library/react` for UI logic (overlay, undo button
      disabled state, theme toggle, restart confirm). Keep engine tests in `node` environment. Configure
      per-file `// @vitest-environment jsdom` or a Vitest project, not a global switch.
- [ ] **Fuzz tests are the slowest part of the suite (~10s).** Move them behind their own script
      (`test:fuzz`) only if watch-mode speed becomes an actual problem, and keep them in CI.

---

## Phase 7: PWA

**First verify `vite-plugin-pwa` supports the Vite version in `package.json`.** If it doesn't, stop and
report options (version pinning, workbox-build directly). Don't hack around it.

- [ ] Web app manifest: name, short_name, description, `start_url`, `scope`, `display: standalone`, `theme_color` and
      `background_color` matching the theme, `orientation` considered (do not force portrait without
      justification), `categories: ["games"]`.
- [ ] Icons: 192 and 512 PNG, **maskable** variants with a proper safe zone, `apple-touch-icon` (180),
      favicon SVG plus ICO. Generate from one source SVG with a script checked into the repo.
- [ ] Service worker via Workbox: precache the app shell, offline play must work fully (the game has no
      network dependency). `registerType: 'prompt'`. Show an unobtrusive "Update available, reload"
      toast, never reload mid-game silently. Clean old caches.
- [ ] Install UX: capture `beforeinstallprompt` and offer an Install button in settings (Chromium). iOS
      Safari has no prompt, so show brief "Share, Add to Home Screen" instructions where relevant.
      Hide the button when already installed (`display-mode: standalone`).
- [ ] Verify standalone behavior: no pull-to-refresh, safe areas, status bar color, splash.
- [ ] Test the update flow on a real deployed build (old SW to new SW), and test airplane mode.

---

## Phase 8: quality gates

- [ ] **Playwright e2e** (Chromium plus WebKit plus mobile emulation): load and play; keyboard move; swipe via
      touch events; mash-queue behavior; win and keep going (use a seeded or injected state); game over;
      undo; theme; persistence across reload; offline after install; reduced-motion emulation. Add a
      test hook or URL param for seeds (for example `?seed=123`), enabled in all builds but harmless,
      which also serves the daily challenge later.
- [ ] Screenshot assertions are optional. If used, pin viewport and disable animations to avoid flakiness.
- [ ] **Lighthouse CI** in GitHub Actions on the production build: target 95+ for Performance,
      Accessibility, Best Practices, SEO, plus PWA checks. Fail the build below budget.
- [ ] **axe-core** accessibility checks in Playwright, in both themes.
- [ ] **Bundle budget:** record the baseline (about 220 kB JS / 69 kB gzip at scaffold). Set a budget
      (for example gzip JS under 100 kB for the shipped game), fail CI when exceeded.
- [ ] Add CI caching for Playwright browsers. Run e2e on PRs.
- [ ] Optional: pre-commit hook (lefthook or husky) running Biome on staged files.

---

## Phase 9: production

- [ ] `vercel.json` (or `vercel.ts` if current docs recommend it): security headers (a strict CSP compatible
      with the inline theme script via hash, `X-Content-Type-Options: nosniff`, `Referrer-Policy`,
      `Permissions-Policy`, `frame-ancestors`/`X-Frame-Options`), and cache rules: hashed `/assets/*`
      `immutable` for a year; `index.html` and the service worker (`sw.js`) `no-cache`; manifest
      short cache. Verify the service worker has the right scope and is never cached stale.
- [ ] Custom domain (owner provides), HTTPS, `www` redirect, correct canonical.
- [ ] Privacy-respecting analytics (Vercel Web Analytics or equivalent, no cookies, no PII). Mention it
      in a short privacy note. Skip it entirely if the owner prefers.
- [ ] Error reporting: a top-level React error boundary with a friendly reset option that clears corrupt
      saved state, plus optional Sentry. Do not add Sentry without asking.
- [ ] `README.md`: what it is, features, architecture diagram of the dependency rule, commands, how
      determinism and undo work, how to add a theme, deployment notes. Add a `LICENSE` (ask the owner
      which).

---

## Phase 10: stretch (ask the owner which to do, in this order of value)

- [ ] **Stats:** games played, win rate, best tile, total moves, average score, per board size.
- [ ] **Variable board sizes (3x3 to 8x8):** engine already supports it. Needs UI size selector, per-size
      saved game and best score, font-scaling check for large sizes (`data-digits` rules), tile gaps and
      radii at 8x8, performance check, and fuzz coverage (already has sizes 3 to 6).
- [ ] **Daily challenge:** shared seed derived from the UTC date (computed in `ui`/`state`, never in
      the engine), one attempt rule or undo limits (owner decides), result stored locally.
- [ ] **Shareable results:** `navigator.share` with clipboard fallback, a text summary and a link with the seed.
- [ ] **Replay mode:** because games are deterministic, store `seed` plus the move list (direction
      sequence) and replay it using the same `gameInput` animation path at selectable speed. Undo
      complicates the move list. Decide to record effective moves only.
- [ ] **Hint system:** expectimax or heuristic search in a Web Worker (the engine is pure and portable). Must
      not block the main thread. Discuss hint limits and score handling with the owner.
- [ ] **Global leaderboard:** requires a backend, anti-cheat (replays can be verified server-side because
      the engine is deterministic), and privacy decisions. Treat as a separate project and propose a design
      first. Do not start without approval.

---

## Owner decisions needed (ask early, do not guess)

1. **Product name and branding.** "2048" is the generic title, and the project name is `fcf_sonnet`. The
   Vercel project is currently `puzlgame`. Pick the user-facing name, icon concept, and colors.
2. **License** for the repo.
3. **Undo policy beyond the default:** unlimited depth (50 cap) is specified. Should undo be limited or
   disabled in a future daily challenge?
4. **Analytics and error reporting:** yes or no.
5. **Sound and haptics:** build them or skip them.
6. **Which Phase 10 items** to build.
7. **Custom domain** (if any).

## Cross-cutting requirements (apply to every task)

- Determinism of the engine is never compromised. No time or randomness enters `src/engine`.
- Every new persisted field gets a schema version bump plus migration.
- Every new interactive element is keyboard accessible, labelled, has a visible focus style, and is
  checked in both themes.
- Every new animation has a reduced-motion variant and uses only `transform` and `opacity`.
- Every new pure function gets tests with hand-worked expectations. Every new bug fix gets a regression test.
- Visual and feel changes end with a request for the owner to check on a real device, saying exactly what to look at.
