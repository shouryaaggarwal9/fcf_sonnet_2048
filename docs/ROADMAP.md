# Roadmap

Work top to bottom. Each task has acceptance criteria. A task isn't done until every
criterion holds and the Definition of Done in AGENTS.md passes. Tick the box in this file
in the same commit.

## Current state

**Live at https://puzlgame.vercel.app**, deployed from `main` by Vercel. Phases 0 to 8 are built,
committed, and green in CI. Phase 9 is untouched; Phase 10 is untouched and needs the owner to
pick.

- [x] Phase 0: Vite + React + TS strict, Biome, Vitest, CI, Vercel deploy
- [x] Phase 1: engine (slide, move, spawn, seeded RNG, game state, win/over, fuzz and purity tests)
- [x] Phase 2: store, board and tile rendering, score boxes, win and game-over overlays
- [x] Phase 3: keyboard, swipe (verified on a real phone), move lock and queue
- [x] Phase 4: tile tracker, slide, spawn, merge pop, ghost hand-off, queue-safe CSS, delayed
      overlay, floating score popup, and all seven of the automatable edge cases from 4.6.
      **Two items deliberately still open, both needing the owner or a device: real-phone duration
      review, and 6x CPU throttle profiling.**
- [x] Phase 5: persistence, best score, undo, theme toggle, restart confirmation, removal of the
      dev controls
- [x] Phase 6: live-region announcements, overlay focus management, dialogs, settings and
      how-to-play, reduced-motion override, safe areas, landscape, metadata, component tests
- [x] Phase 7: PWA (manifest, generated icons, service worker, offline, install UX). **Two items
      still open, both needing a real phone: standalone behaviour, and the update flow plus
      airplane mode.**
- [x] Phase 8: Playwright e2e on three browsers, axe in both themes, Lighthouse CI, bundle budget,
      CI caching. Found and fixed four real bugs.
- [x] Phase 9 (mostly): security headers and cache rules in `vercel.json`, a crash screen,
      `README.md`. Deployment confirmed sufficient at the `vercel.app` hostname. **Owner decisions
      closed:** no analytics, no Sentry (errors stay in the console), `LICENSE` skipped for now.
      **Still open:** only the two device-only checks in 4.6.

Gates at the end of Phase 9, all verified on CI rather than locally only: lint clean with zero
warnings, typecheck clean across app/node/e2e, 500 unit and component tests in 30 files, 159 e2e
tests across Chromium, WebKit, and a Pixel 7 viewport (157 passing, 2 skipped), bundle 77.3 kB JS
and 3.2 kB CSS gzipped against budgets of 100 and 12, Lighthouse 99 Performance and 100 for
Accessibility, Best Practices, and SEO.

Also shipped in Phase 9: pinch-zoom is blocked (the owner's call), a swipe can now start below the
board inside its width, and the seven timing edge cases from 4.6 are all covered.

**Clearest next steps.** The roadmap is effectively complete: Phases 0 to 9 are built, gated, and
deployed, and the only open items are the two device-only checks in 4.6.

1. Real-device feel checks (4.6): the animation durations on a phone, and a 6x CPU throttle
   profile. No gate can substitute for either.
2. Phase 10, if and when the owner wants any of it. Stats and a daily challenge are the cheapest;
   replay mode is the one that makes the determinism visible to a player. Nothing here is needed
   for the game to be finished.
3. `LICENSE`, if the project is ever opened up. Unanswered for now, which means all rights
   reserved.

Owner-only, cannot be closed by an agent: real-device feel checks, and the deferred Phase 10
product decisions.

Previously listed as temporary and now genuinely resolved: the `up/left/down/right` dev controls
and `.dev-controls` (removed in 5.5), the placeholder title and favicon (Phase 6 and 7), and
focus staying on the header button when the overlay appears (Phase 6, then hardened in Phase 8,
which found dialogs were not restoring focus in Safari at all).

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
      **Still open. This is the one item that most needs the owner's eyes.**
- [ ] Profile on a throttled CPU (DevTools 6x slowdown): sliding stays smooth. If `container-type: size` on every
      tile or `backdrop-filter` on the overlay causes cost, measure and fix it. Don't guess.
      **Still open.** Not attempted rather than attempted and glossed over: a frame-time number
      from a headless runner on a desktop CPU says nothing useful about a mid-range phone.
- [x] **Automatable edge cases, from the list this phase originally specified.** All seven are now
      covered in `e2e/timing.spec.ts`, on all three browsers where that is possible. They are all
      timing bugs, which is exactly the class that never shows up in a unit test and only
      reproduces on a device, where it gets misdiagnosed as "the animation feels off".
      - [x] Mash keys: queue of 2 and the move lock honoured.
      - [x] New game mid-animation: the board settles, the outgoing layer is cleaned up, and input
            is accepted immediately, which is the `gameInput.reset()` invariant under a race.
      - [x] Tab hidden and restored mid-animation. Chromium only, via CDP
            `Page.setWebLifecycleState`, because faking `document.hidden` does not stop the browser
            running animations and so would prove nothing. WebKit has no equivalent, so the test is
            skipped there rather than weakened.
      - [x] Window resize mid-slide: every tile still lands in its own cell afterwards.
      - [x] Two simultaneous pops, and merge plus spawn at the same instant. Reached by really
            playing: seed 1 with left, right, up leaves `2 . . 2 / . . . 4 / 2 . . 2`, and one more
            left merges two pairs at once for a gain of 8 while also spawning a tile. Verified
            against the engine rather than reasoned about, so no board-injection hook was needed.
      - [x] Page load shows no animation, and a restart deliberately does. Those are different
            code paths and the distinction is the reason `birth` is modelled at all.
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
- [x] A Playwright test (Phase 8) for undo via button and via keyboard. *(Undo via the button is
      covered on all three browsers, plus undo surviving a reload, undo leaving no ghost tiles
      behind, and undo clearing on restart.)*

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
- **`store.boardEpoch`** is bumped by undo and by `adopt`. The board keys its live tile layer on it, so a
      replacement never reuses a DOM node from the board it replaced; a reused node would slide from
  a stale position. Ordinary slides never change it, so they are untouched.
- **The replacement is a dissolve, not a fade-in.** The owner reported that fading the new board in
  made everything "reappear with a pop", which was accurate: the whole board was materialising from
  `opacity: 0`. Now the live board is correct from its first frame and the board it replaced sits
  on top of it and fades out (`board-dissolve`). The outgoing layer is `pointer-events: none` and
  `aria-hidden`, and is removed on `animationend` with a 400ms timeout backstop for a backgrounded
  tab, where animations do not run.
- `isUndoKey` sits in `ui/input.ts` beside `keyToDirection` but is a separate function. It cannot
  live in the direction map: `keyToDirection` rejects every modified key, which would make
  `Ctrl+Z` impossible. A test asserts no key triggers both.
- `restart` clears history but keeps `best`. `adopt` takes the other tab's history, since that
  game's history no longer describes this board.

### 5.3 Theme toggle: system / light / dark (owner-requested)

Current theming uses `@media (prefers-color-scheme: dark)` blocks in `src/index.css` and
`src/ui/Board.css` (including tile tier 1 and 2 dark variants). This must be refactored so the
user's choice can override the system.

- [x] **Three states:** `system` (default), `light`, `dark`. Persisted in settings (5.1). Apply by
      setting `data-theme="light|dark"` on `<html>`. In `system` mode, resolve through `matchMedia` and
      **live-update** when the OS setting changes (listener cleaned up properly).
- [x] **Refactor CSS:** all colors live in CSS custom properties defined once for light and once
      for dark under `:root[data-theme="light"]` / `:root[data-theme="dark"]`. No remaining
      `prefers-color-scheme` media queries for colors except the single place that resolves `system`
      (or resolve it in JS and always set `data-theme`). Set `color-scheme` per theme so native
      controls and scrollbars match. Tile palettes move to variables, not duplicated selectors.
- [x] **No flash of wrong theme:** a tiny inline script in `index.html` `<head>` reads the stored setting
      and sets `data-theme` before first paint. It must be try/catch-safe. **Note for Phase 9:** an inline
      script requires a CSP hash or nonce. Plan the CSP accordingly. Do not use `unsafe-inline`.
- [x] **`<meta name="theme-color">`** updates with the resolved theme (and later feeds the PWA manifest).
- [x] **Toggle UI:** an accessible control in the header. Recommended: a single icon button cycling
      system, light, dark, with `aria-label` stating the current mode and the next action (or a
      3-option radio group in a settings popover). Icon changes per mode. Minimum 44x44px target.
      Keyboard operable, visible focus, announces changes.
- [x] **Overlay and score colors** also come from variables. Check every component in both themes.
- [x] **Contrast audit (both themes):** verify WCAG AA for all tile text and UI text. The classic palette's
      light text on yellow tiles (tiers 7 to 11) is **known to be low contrast**. Compute ratios, then adjust
      colors or text colors so every tier passes at least 4.5:1 for numbers (3:1 minimum for large text if
      you argue it's large, and document it). Keep tiers visually distinct.
- [x] Tests: theme resolution function (pure, with injected `matchMedia` result), cycling order, storage
      fallback. Playwright (Phase 8): toggling changes `data-theme`, persists across reload, and `system`
      follows `emulateMedia`.

Notes, and what the audit actually found:

- **The toggle is two states, not three.** The owner's brief was a switch between the two themes
  that already worked, so it is one icon button. A first visit still follows the OS and the choice
  is remembered from then on. The `system` value is retained as the unset default so a save from a
  first visit round-trips, and so a three-way control remains possible later.
- **The roadmap understated the contrast problem.** Measured against the authentic values read from
  `gabrielecirulli/2048`, the original palette fails AA on **ten of twelve** tiers, not only the
  yellows: tiers 1 and 2 at 3.98 and 3.83, tiers 3 to 6 at 1.72 to 2.96, tiers 7 to 11 at 1.42 to
  1.58. The original predates WCAG 2.1.
- **Tile backgrounds are untouched.** All twelve are still the authentic colours, asserted by test,
  so the game still reads as 2048. Only the ink changed: dark `#231f1a` on the bright tiles and
  light on the single dark super tile. Worst tier is now 5.13:1, verified in the live DOM.
- **UI chrome had unrecorded debt.** The score value on the tan panel measured 2.03:1 and the
  primary button 2.96:1. The secondary button and the dark theme's primary button failed with
  *both* white and dark ink, so those two backgrounds were darkened rather than their text changed.
  The score label also used `opacity: 0.8`, which blended toward the panel and quietly undid its
  own contrast; it is a solid dim ink now.
- **Enforced, not just documented.** `src/state/contrast.test.ts` parses the shipped CSS, computes
  WCAG ratios, and fails the build if any tier or UI pair drops below AA, if the authentic tile
  colours drift, or if a tier stops having a resolvable ink. That last check exists because of a
  real bug: a tier that set `--tile-bg` without `--tile-fg` made `color: var(--tile-fg)` invalid, so
  the tile inherited the body colour at 1.9:1 **while that test file was green**. Only measuring
  the live DOM caught it. `.tile` declares a default ink now, so it cannot recur.
- Two judgement calls need the owner's eye: dark numerals on the orange and yellow tiles is a
  visible departure from the classic look, and the two darkened buttons.

### 5.4 New game and restart behavior

- [x] "New game" on a game in progress (`moves > 0` and status `playing`) asks for confirmation
      through an accessible modal (`<dialog>` with focus trapping and Escape handling). No confirm on
      fresh or over states. Make the confirm copy mention that undo is not available after restart.
      *(Shipped in Phase 5.4; the box was left unticked.)*
- [x] Both restart paths call `gameInput.reset()` first (already true in `handleRestart`. Keep it).

### 5.5 Remove the dev controls (and replace them properly)

- [x] Delete the temporary direction buttons and `.dev-controls`.
- [x] **WCAG 2.5.1 (pointer gestures):** swipe is a path-based gesture, so offer a single-tap alternative.
      Add an optional on-screen D-pad, toggled in settings and off by default, wired through `gameInput`.
      Keyboard users are already served.

Notes for 5.4 and 5.5:

- **The confirmation uses the native `<dialog>`**, not a hand-rolled modal. The platform already
  provides the top layer, the focus trap, inerting the page behind it, Escape, and focus
  restoration. `showModal()` is called imperatively, because React's `open` prop yields a plain
  dialog with none of that. Verified in the browser: focus lands on "Keep playing" (the safe
  choice), Escape closes without losing the game, and the copy names the move count and says
  undo cannot bring it back.
- **Confirm is asked only when there is progress to lose** (`moves > 0` and status `playing`), per
  `shouldConfirmRestart`. A finished game has its own New game button on the overlay, and
  confirming there too would mean two dialogs to start the next game.
- **Input is gated while the dialog is open.** The page behind a modal is inert to pointer events,
  but the key listeners sit on `window` and would still fire, so a move could land behind the
  dialog. `App` checks a ref, not the state value, so a handler cannot read a stale closure.
- **The D-pad goes through `gameInput`, not the store**, so a tap obeys the same move lock and
  queue as a key press. Mashing the pad behaves exactly like mashing the arrow keys.
- **The D-pad is a `<fieldset>` with a visually hidden `<legend>`**, not `role="group"`, which is
  what Biome's `useSemanticElements` asks for and is genuinely the right element for a control
  group. There is no `autoFocus` prop on the dialog's first button: `showModal()` already focuses
  the first focusable element, landing on the safe choice without asking React to do it.
- **Schema is now v3.** v2 had no `dpad` setting, so `migrate()` starts it hidden, and
  `settings.dpad` only accepts a literal `true` so a tampered value cannot switch the pad on.
- Verified in the browser: dev controls gone, pad hidden by default and persisted when enabled,
  smallest pad button 52px, pad taps play moves, restart clears history so undo disables.
- The pad toggle lives in the action row rather than a settings dialog, because the settings
  dialog is Phase 6. When that arrives the toggle should move into it and the icon button go.

---

## Phase 6: polish and accessibility

- [x] **Layout:** responsive from 320px to desktop, portrait and landscape phones (the current board width
      `min(92vw, 60dvh, 480px)` is a starting point). Safe-area insets (`env(safe-area-inset-*)`) for
      notched phones and standalone PWA. Test landscape specifically.
- [x] **Screen readers:** a visually hidden `aria-live="polite"` region announcing meaningful events only
      (for example "Merged to 128. Score 1,456." and "Game over"), not every tile. Board has an
      accessible name and a short instructions text. Ghost tiles remain `aria-hidden`. Overlays are
      dialogs.
- [x] **Focus management:** when the win or game-over overlay appears, move focus to its primary button and
      restore it afterwards. *(The "known issue: focus stays on the header button" note here was
      fixed in Phase 6 and hardened in Phase 8, which found that dialogs were not restoring focus
      at all in Safari. See Phase 8.)*
- [x] **Keyboard:** visible `:focus-visible` everywhere. Logical tab order. Document shortcuts in a
      How-to-play dialog (rules, controls, undo shortcut).
- [x] **Settings dialog:** theme, on-screen D-pad, reduced-motion override (respect system by default),
      sound and haptics toggles if implemented.
- [ ] **Sound and haptics (optional):** `navigator.vibrate` for merges where supported, short
      Web Audio blips. Off by default or at least obviously mutable. Respect user gesture rules for audio.
      Check that it adds negligible weight.
      **Declined by the owner.** Not an oversight; do not add without asking.
- [x] **Branding:** product name, favicon, header, and metadata (see "Owner decisions"). Open Graph and Twitter
      card image, `<meta name="description">`, `lang`, canonical URL.
      *(Shipped in Phase 6: name "2048" by owner decision, generated favicon and icon set,
      `og-image.svg`, description, `lang="en"`. **Canonical URL is deliberately deferred to
      Phase 9**, with the custom domain, since it should point at the final hostname. Note the
      live site has no `rel="canonical"` today.)*
- [x] **Component tests:** add jsdom and `@testing-library/react` for UI logic (overlay, undo button
      disabled state, theme toggle, restart confirm). Keep engine tests in `node` environment. Configure
      per-file `// @vitest-environment jsdom` or a Vitest project, not a global switch.
- [x] **Fuzz tests are the slowest part of the suite (~10s).** Move them behind their own script
      (`test:fuzz`) only if watch-mode speed becomes an actual problem, and keep them in CI.

What Phase 6 did, and what it deliberately left open:

- **Announcements are quiet on purpose.** A live region speaks for merges, reaching 2048, and game
  over, and says nothing for a move that only slid tiles. The store now reports which tiles a move
  merged (`lastTurn.merged`), so the wording can name them. Two details worth keeping: the region is
  `polite`, never `assertive`; and it clears before each new sentence, because a live region only
  speaks when its content *changes* and two identical merges would otherwise be silent.
- **Undoing announces nothing**, because an undo clears `lastTurn`. The region keeps the sentence it
  last said, which is correct, because retaining content announces nothing.
- **The board is `role="img"` with a label**, not a grid of sixteen tiles. Walking them is noise and
  the live region covers the changes. The instructions sit on the board's label.
- **The overlay takes focus when it settles and restores it afterwards**, which was the known issue.
  Restoring matters as much as taking: otherwise dismissing it drops the player at the top of the
  document. Verified by a component test as well as in the browser.
- **One `Modal` shell** does the focus trap, Escape, backdrop, and focus restoration for both the
  settings and how-to-play dialogs, so the two cannot drift apart. The native `<dialog>` does the real
  work; `showModal()` is called imperatively because React's `open` prop gives a plain dialog.
- **Motion moved from a media query to `data-motion`.** A media query cannot see an in-app preference,
  so honouring an override would have meant duplicating every reduced-motion block under a second
  selector. The boot script sets `data-motion` next to `data-theme`, so an override is correct from the
  first paint. Choosing Full is a deliberate override of the OS, and the dialog says so.
- **The focus ring is a themed variable, not `currentColor`,** and covers radios and checkboxes as
  well as buttons, which would otherwise fall back to a browser default matching neither theme.
  `contrast.test.ts` asserts it clears 3:1 against every surface it lands on.
- **Component tests** use jsdom and Testing Library, opted in per file so the rest of the suite stays
  in node. The production bundle is byte-identical, which is how the dev-only claim was checked.
  Plain assertions are used rather than jest-dom matchers, to avoid a dependency for `textContent`.
- **The fuzz tests stayed in `test`.** The roadmap only moves them if watch mode is genuinely slow,
  and it is not: vitest re-runs only affected files, so the 10s of fuzz costs anything only when the
  engine changes. A `test:fuzz` script was added for running them alone.

Two items are **not** done, both because they are owner decisions rather than engineering:

- **Sound and haptics.** Marked optional here and listed as an open question. Sound is a taste call
  the roadmap reserves for the owner. The settings dialog is now ready to take the toggles.
- **Branding.** The metadata is done: description, Open Graph and Twitter tags, `viewport-fit=cover`
  for safe areas, an `og-image.svg` built from the same tile colours so it cannot drift, and
  `lang="en"`. The product name, favicon, and icon concept are still open question 1, so the title
  stays "2048" and no name was invented.

---

## Phase 7: PWA

**First verify `vite-plugin-pwa` supports the Vite version in `package.json`.** If it doesn't, stop and
report options (version pinning, workbox-build directly). Don't hack around it.

- [x] Web app manifest: name, short_name, description, `start_url`, `scope`, `display: standalone`, `theme_color` and
      `background_color` matching the theme, `orientation` considered (do not force portrait without
      justification), `categories: ["games"]`.
      *(Shipped in Phase 7; the box was left unticked. `orientation` deliberately omitted so
      landscape phones and tablets work, and a unit test now fails if it is ever added.)*
- [x] Icons: 192 and 512 PNG, **maskable** variants with a proper safe zone, `apple-touch-icon` (180),
      favicon SVG plus ICO. Generate from one source SVG with a script checked into the repo.
      *(Shipped in Phase 7. `pnpm icons` regenerates `public/` from `icon-source.svg` via `sharp`
      and `sharp-ico`, because `@vite-pwa/assets-generator` wanted plugin major ^1 while the
      current release is 2.)*
- [x] Service worker via Workbox: precache the app shell, offline play must work fully (the game has no
      network dependency). `registerType: 'prompt'`. Show an unobtrusive "Update available, reload"
      toast, never reload mid-game silently. Clean old caches.
      *(Shipped in Phase 7, and offline load is now asserted in `e2e/` on Chromium and
      mobile-chrome. `skipWaiting: false` and `clientsClaim: false` mean the first visit is
      deliberately uncontrolled, so offline applies from the second visit onwards.)*
- [x] Install UX: capture `beforeinstallprompt` and offer an Install button in settings (Chromium). iOS
      Safari has no prompt, so show brief "Share, Add to Home Screen" instructions where relevant.
      Hide the button when already installed (`display-mode: standalone`).
      *(Shipped in Phase 7 as `InstallRow` in the settings dialog, with the iOS instructions and an
      honest "Install unavailable in this browser" fallback.)*
- [ ] Verify standalone behavior: no pull-to-refresh, safe areas, status bar color, splash.
      **Owner, on a real phone.** Safe-area insets and `viewport-fit=cover` are implemented and
      `overscroll-behavior` is set, but nothing has confirmed the status bar or splash.
- [ ] Test the update flow on a real deployed build (old SW to new SW), and test airplane mode.
      **Owner, on a real phone.** The prompt-and-reload flow is wired, and the offline path is
      tested in Chromium, but the old-SW-to-new-SW transition needs a real deployment cycle.
      **Airplane mode in Safari is a known gap**: Playwright's WebKit cannot survive an offline
      reload (see Phase 8), so that combination is unverified by machine.

---

## Phase 8: quality gates

- [x] **Playwright e2e** (Chromium plus WebKit plus mobile emulation): load and play; keyboard move; swipe via
      touch events; mash-queue behavior; game over; undo; theme; persistence across reload; offline after
      install; reduced-motion emulation. `?seed=123` added, enabled in all builds but harmless, which also
      serves the daily challenge later.
- [x] Screenshot assertions skipped, deliberately: every assertion here is about state or focus rather than
      pixels, and pixel assertions on an animated board are the flakiest thing that could be added.
- [x] **Lighthouse CI** in GitHub Actions on the production build: target 95+ for Performance,
      Accessibility, Best Practices, SEO. Fail the build below budget.
- [x] **axe-core** accessibility checks in Playwright, in both themes.
- [x] **Bundle budget:** baseline recorded, gzip JS under 100 kB, CI fails when exceeded.
- [x] Add CI caching for Playwright browsers. Run e2e on PRs.
- [ ] Optional: pre-commit hook (lefthook or husky) running Biome on staged files. **Not done, on purpose.**

### Phase 8 decisions

- **The seed URL parameter seeds only a fresh install.** It is `?seed=123`, validated strictly (whole
  numbers only, coerced to the signed 32-bit range the engine uses), and it applies *only when there is
  no saved game*. Letting the seed always win was the first implementation and it was quietly broken:
  moves were still written to storage, so progress was saved and then never read, and every reload
  discarded the game. "Reload keeps my game" matters more than link fidelity. The Phase 10 daily
  challenge will need its own storage key for the same reason.
- **Game over is reached by really playing, not by an injected state.** The engine-level tests measured
  how many moves a rotation strategy needs per seed (seed 21 takes 79), so `playToEnd` paces one keypress
  per slide and those tests are fast and honest. No test hook that can force a board was added.
  **Win and keep-going are covered in jsdom instead**, by driving the store directly: reaching 2048 in a
  browser would need a real solver and thousands of keypresses, which would be a slow test that tests
  nothing extra, since the overlay is the same component with the same focus handling as game over.
- **No Lighthouse PWA assertions, because they no longer exist.** Lighthouse removed the PWA category and
  with it the `installable-manifest`, `service-worker`, `maskable-icon` and `tap-targets` audits; asserting
  them fails with "is not a known audit" rather than passing quietly. PWA behaviour is asserted in the
  end-to-end suite instead, which can actually test it: manifest link, every icon it names, the worker
  registering and taking control, and the app loading with the network off.
- **Scores are a smoke test; the bundle script is the budget.** Measured 96–98 Performance, 100
  Accessibility, 100 Best Practices, 100 SEO. Performance has ~1 point of headroom over the 0.95 threshold,
  so it could go red on a slow runner. That is an acceptable trade: the deterministic gate that actually
  stops a dependency adding weight is `scripts/check-bundle.mjs` (77.0 kB JS, 3.1 kB CSS against 100/12 kB).
- **`robots.txt` was missing and Lighthouse found it.** The SPA fallback served `index.html` for it, which
  cost 9 SEO points. Added a real one.
- **Offline is skipped on WebKit, as a tooling limit, not a choice.** Measured: on a page with *no service
  worker at all*, `setOffline(true)` plus `reload()` still fails with "WebKit encountered an internal
  error". Route interception would not help, because intercepted routes are not what a worker fetches.
  **So offline play in real Safari is unverified** and needs a device check. The worker does register and
  take control in WebKit, so the wiring is right.
- **The e2e suite is typechecked**, via `tsconfig.e2e.json` with the same `noUncheckedIndexedAccess` and
  `strict` as the app. This immediately caught five real errors in the tests on the day it was added.
- **No pre-commit hook.** It needs a `prepare` install step that can silently not run, it only sees staged
  files so it is weaker than the full `pnpm lint` CI already runs on every push and PR, and it would add a
  dependency. Available on request.

### Phase 8 verification

All three CI jobs passed on GitHub's Linux runners on commit `bcd8ef3`, not just locally: lint,
types, unit tests, build and bundle; the full end-to-end suite; and Lighthouse. The live
deployment was then checked directly — `robots.txt` returns 200 and the page has exactly one
manifest link, confirming the Phase 8 fixes shipped.

### Phase 8 bugs found and fixed

The suite was worth writing for these alone:

- **Focus was not restored when a dialog closed in Safari.** `Modal` had no restore logic at all and was
  relying on Chromium's native `<dialog>` doing it, which WebKit does not. Dismissing a dialog in Safari
  dropped a keyboard player at the top of the document. Fixed with `useModalDialog`, which captures the
  opener *before* `showModal()` and restores focus on the `close` event rather than on a state change.
  `GameOverlay` is a `div[role=dialog]`, so it keeps its own `useOverlayFocus`; the two cannot share one
  hook because only one of them has a `showModal()` to call.
- **Buttons were under the 44px touch target floor.** The text buttons were 37px tall. `.btn`, `.btn-sm`
  and the settings options now all have a 44px minimum.
- **`index.html` shipped two identical manifest links**, one from `vite-plugin-pwa` and one hand-written.
- **A pre-existing Biome warning** in `GameOverlay.tsx` (`previous &&` should be `previous?.`) is gone, so
  `pnpm lint` is clean rather than "clean with one warning".
- **`tileTracker.test.ts` was flaky.** The heaviest test in the suite took 7s against Vitest's 5s default
  and failed intermittently on a loaded machine. Given an explicit 30s budget on that one test, so every
  other test still fails fast.

---

## Phase 9: production

**Deployment already works.** Vercel is linked to this repo and auto-deploys `main` to
https://puzlgame.vercel.app, verified live at the end of Phase 8. So this phase is no longer
about getting the app online; it is about hardening and documenting what is already up. That also
means **every push to `main` publishes**, so the full local gate matters more here, not less.

- [x] `vercel.json` (or `vercel.ts` if current docs recommend it): security headers (a strict CSP compatible
      with the inline theme script via hash, `X-Content-Type-Options: nosniff`, `Referrer-Policy`,
      `Permissions-Policy`, `frame-ancestors`/`X-Frame-Options`), and cache rules: hashed `/assets/*`
      `immutable` for a year; `index.html` and the service worker (`sw.js`) `no-cache`; manifest
      short cache. Verify the service worker has the right scope and is never cached stale.
      *(Shipped. The CSP allows exactly one inline script by hash, `worker-src 'self'` is present
      so the service worker is not silently blocked, and `style-src` keeps `'unsafe-inline'` because
      tiles are positioned with inline style attributes. Three ways it is held honest: `pnpm csp`
      recomputes the hash from `dist/index.html`, a unit test fails if the two disagree, and
      `vite preview` serves the real headers so the end-to-end suite runs under the actual policy.
      The offline test passing under the CSP is the load-bearing evidence.)*
- [x] Deployment is **done and sufficient**: Vercel, linked to this repo, auto-deploys `main` to
      https://puzlgame.vercel.app, verified live. The owner has confirmed the `vercel.app` hostname
      is good enough, so no custom domain is wanted and `rel="canonical"` is not needed either.
      **Closed deliberately, not overlooked.**
- [ ] Privacy-respecting analytics (Vercel Web Analytics or equivalent, no cookies, no PII). Mention it
      in a short privacy note. Skip it entirely if the owner prefers.
      **Owner decision: no analytics.** Closed, not deferred. A game with no accounts and no
      backend gains little from visitor counts, and declining keeps the CSP tight with no
      third-party `connect-src` and no privacy note to maintain. Vercel's own logs show traffic
      if a number is ever wanted.
- [x] Error reporting: a top-level React error boundary with a friendly reset option that clears corrupt
      saved state, plus optional Sentry. Do not add Sentry without asking.
      *(The boundary shipped. Tested by throwing on purpose, so the fallback runs every test rather
      than only existing. The recovery button says plainly that the game is lost. **Sentry was not
      added**: errors go to the console and to the player, nothing leaves the device.)*
- [x] `README.md`: what it is, features, architecture diagram of the dependency rule, commands, how
      determinism and undo work, how to add a theme, deployment notes.
      *(Shipped, including the parts that are not obvious: why determinism makes undo exact, why
      tile DOM order must never change, why the boot script is inline, and which two cache rules
      matter.)*
- [ ] `LICENSE` (**owner decision: skip for now**). Left unwritten deliberately rather than
      overlooked. Worth remembering what that means: with no LICENSE the default is "all rights
      reserved", so nobody may legally reuse, fork, or contribute to the code. If the project is
      ever opened up, this needs an answer — MIT, Apache-2.0, and GPL-3.0 are all defensible here
      and mean very different things.

---

## Phase 10: stretch (ask the owner which to do, in this order of value)

**Nothing in this phase is started, and none of it is needed for the game to be finished.** The
app is live, installable, offline-capable, accessible, and gated by CI. Everything below is
additive. Two items are explicitly not to be started without the owner: the hint system (product
decisions) and the global leaderboard (a backend, and its own project).

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
