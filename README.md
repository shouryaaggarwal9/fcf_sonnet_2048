# 2048

A 2048 game that runs in the browser, installs to a home screen, and works offline. No account, no
server, no tracking. The whole game is one page and about 77 kB of JavaScript.

Play it at **https://puzlgame.vercel.app**

## What it does

- Slide tiles with the arrow keys, WASD, or a swipe. Merging two equal tiles doubles them.
- Undo any move, as far back as 20 moves even after a reload.
- Light and dark themes, following the system by default.
- Respects `prefers-reduced-motion`, with an in-app override for people whose system setting is
  wrong for them.
- Installable as an app. Works with no network once it has loaded once.
- Keeps your game, your best scores per board size, and your settings across visits.
- A seeded link: `?seed=123` starts that exact game, which is also how the tests reach a
  particular board.

## Running it

```sh
pnpm install
pnpm dev          # http://localhost:5173
```

Node 22 and pnpm 10 (pinned in `package.json` via `packageManager`).

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Dev server |
| `pnpm build` | Typecheck, then production build into `dist/` |
| `pnpm preview` | Serve the production build |
| `pnpm test` | Unit and component tests |
| `pnpm lint` | Biome check (`lint:fix` to autofix) |
| `pnpm typecheck` | `tsc` across the app, the build config, and the e2e suite |
| `pnpm e2e` | Playwright, on Chromium, WebKit, and a phone viewport |
| `pnpm bundle` | Fail if the built assets exceed the gzip budget |
| `pnpm lighthouse` | Lighthouse against the production build |
| `pnpm icons` | Regenerate the icon set from `icon-source.svg` |
| `pnpm csp` | Recompute the CSP hash for the inline boot script and write it to `vercel.json` |

**Definition of done:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build` all pass, and CI
is green. If a change touches rendering, dialogs, input, or anything else a browser has to agree
on, `pnpm e2e` has to pass too.

### Why so many gates

They overlap deliberately, because each one catches something the others cannot:

- `pnpm test` is fast and has no browser in it.
- `pnpm typecheck` covers `e2e/` with the same strictness as the app.
- `pnpm bundle` is the deterministic budget, and the gate that actually stops a dependency from
  quietly adding weight.
- `pnpm e2e` is the only gate that runs WebKit. Three bugs got past everything else by only
  existing there, one of them focus not being restored when a dialog closed in Safari.
- `pnpm lighthouse` is a smoke test. Scores wobble; `pnpm bundle` does not.

## Architecture

One rule, and everything else follows from it:

```
src/ui  ->  src/state  ->  src/engine
```

Dependencies point one way only.

- **`src/engine`** is pure, deterministic game logic. It never imports React, never touches the
  DOM, and never uses `Math.random`, `Date`, or storage. A test scans the source to keep it that
  way. Its entire public surface is `src/engine/index.ts`; everything else imports from there, not
  from the individual modules.
- **`src/state`** owns the Zustand store, the tile tracker, persistence, and undo. It knows
  nothing about the UI.
- **`src/ui`** is components, hooks, and CSS. It talks to the game only through the store and
  `gameInput`.

### Determinism, and why it is worth the trouble

The random number generator is `mulberry32`, and its entire state is a single integer. The same
seed plus the same sequence of moves always produces the same game, tile for tile.

That one property pays for a surprising amount:

- **Undo is exact.** Each snapshot is the game state; restoring it also restores `rngState`, so a
  merge you undo and replay lands in precisely the same place.
- **Tests can reach real end states.** A win or a game over is reproducible from a seed, which is
  why the end-to-end suite can test them instead of mocking them away. `?seed=` exists for that.
- **A game can be shared as a link**, and in principle verified by a server rather than trusted.

### Tiles have identities

Animating a grid of numbers means the browser has to believe a tile is the same tile before and
after a move. So each tile gets an id from `src/state/tileTracker.ts`, and **the DOM order of
tiles never changes** — new tiles always get higher ids. Reordering nodes makes browsers cancel
running transitions, which looks like the animation randomly stuttering.

Ids are never reused, not even across new games, and each tile's `birth` is immutable, so an
entrance animation plays exactly once per tile rather than on every re-render.

### Animation is only a view

The logic runs instantly and the animation follows it. Timing lives in exactly one place,
`src/ui/motion.ts`, which also publishes the values to CSS as custom properties so no number is
ever written twice.

Tiles slide first. Spawn and merge effects start at the moment the slide ends, using
`animation-delay` with `fill-mode: backwards` rather than timers, so there is no JavaScript in the
timing path and nothing to drift out of sync. Only `transform` and `opacity` are animated.

### Offline

`vite-plugin-pwa` precaches the shell through Workbox. Updates are offered, never applied: the
worker is configured with `skipWaiting: false` and `clientsClaim: false` so an update can never
reload a game out from under the player. The first visit is deliberately not controlled by the
worker, so offline play applies from the second visit onwards.

## Deployment

Vercel, connected to this repository, deploying `main` automatically. **Pushing to `main` is a
publish**, so run the gate first.

`vercel.json` holds the security headers and cache rules. Two of them matter more than the rest:

- `sw.js` and the Workbox runtime are served `must-revalidate`. Get this wrong and returning
  visitors pin an old service worker indefinitely, which is the classic way a PWA keeps serving
  an old build after you have fixed it.
- `/assets/*` is `immutable` for a year, safe because those filenames are content-hashed.

The Content-Security-Policy allows exactly one inline script, by SHA-256 hash: the boot script in
`index.html` that applies the saved theme before the first paint, without which the page renders
light and snaps to dark. If you change that script, run `pnpm build && pnpm csp`, and commit the
updated `vercel.json`. A test fails if the two ever disagree.

`vite preview` serves those same headers during `pnpm e2e`, so the end-to-end suite runs under
the real policy instead of a copy of it.

## Accessibility

Treated as a requirement rather than a finish.

- The board is a labelled `role="img"`; tiles are numbers in a picture and are not walked
  individually.
- A polite live region announces merges, reaching 2048, and game over, and stays silent for a
  move that only slid tiles.
- Dialogs are real `<dialog>` elements that take focus on open and **return it to whatever opened
  them**. This is checked on WebKit as well as Chromium, because Chromium restores focus natively
  and WebKit does not — the bug was invisible until the suite ran a second engine.
- Every control is at least 44x44px, and keyboard reachable with a visible focus ring.

### Known tradeoff: pinch-zoom is disabled

The game has nothing to magnify, and a zoomed page turns the next swipe into browser back/forward
navigation. So `user-scalable=no` and `touch-action: pan-x pan-y` are set.

This fails WCAG 2.1 SC 1.4.4 (Resize Text), and axe-core's `meta-viewport` rule reports it. That
one violation is accepted deliberately and listed in `e2e/accessibility.spec.ts`, where every other
axe rule is still enforced. Text-only zoom and browser font scaling continue to work; only
pinch-to-magnify is blocked. Worth knowing that iOS Safari is expected to ignore `user-scalable`
for accessibility reasons regardless, which has not been verified on a device.

## Testing

478 unit and component tests, 128 end-to-end. Vitest for logic (no browser, the default) and
opted into jsdom per file for components. Playwright against the **production** build, because
the service worker, the precache, and hashed assets all behave differently in dev and "works in
dev" is not the claim being made.

axe runs in both themes. A small number of things are asserted by hand because no tool sees them:
paint order is checked by hit-testing with `elementFromPoint`, since a merged tile once painted
over the game-over overlay and only a computed `z-index` would have hidden that.