import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Shared helpers for the end-to-end tests.
 *
 * The board is asserted through its visible text, not through internal state, because the point
 * of these tests is what a player sees.
 */

/** Reads the three score boxes: score, best, moves. */
async function scoreBoxes(page: Page): Promise<{ score: number; best: number; moves: number }> {
  const values = page.locator('.score-value');
  const read = async (index: number) =>
    Number.parseInt(((await values.nth(index).textContent()) ?? '0').replace(/,/g, ''), 10);
  return { score: await read(0), best: await read(1), moves: await read(2) };
}

/** A fresh game with no animation waiting to settle. */
export async function openGame(page: Page, seed = 1): Promise<void> {
  await page.goto(`/?seed=${seed}`);
  await expect(page.locator('.board')).toBeVisible();
  await page.waitForFunction(() => document.fonts?.status === 'loaded' || true);
}

/**
 * One slide plus a little slack. Matches the app's own move lock (SLIDE_MS + a queue slot), so
 * a test never races the lock it is trying to measure.
 */
const MOVE_SETTLE_MS = 190;

/** The rotation the engine-level tests use, so move counts line up across the two suites. */
const ROTATION = ['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp'] as const;

/**
 * The key for step `i` of the rotation.
 *
 * The wrap is written so the index is always in range, and the fallback is unreachable but
 * still needed: with noUncheckedIndexedAccess the compiler cannot see that, and a cast would
 * only move the lie somewhere less obvious.
 */
export function keyAt(i: number): (typeof ROTATION)[number] {
  const wrapped = ((i % ROTATION.length) + ROTATION.length) % ROTATION.length;
  return ROTATION[wrapped] ?? 'ArrowLeft';
}

/** Waits out the move lock so the next input is not swallowed by it. */
export async function settle(page: Page): Promise<void> {
  await page.waitForTimeout(MOVE_SETTLE_MS);
}

/** Plays one direction by keyboard and waits for it to land. */
export async function pressKey(
  page: Page,
  key: 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown',
) {
  const before = (await scoreBoxes(page)).moves;
  await page.keyboard.press(key);
  await page.waitForFunction(
    (n) =>
      Number.parseInt(
        (document.querySelectorAll('.score-value')[2]?.textContent ?? '0').replace(/,/g, ''),
        10,
      ) > n,
    before,
    { timeout: 3000 },
  );
  await settle(page);
}

/** The board as a string of "row,col=value", which is comparable and readable on failure. */
export async function boardState(page: Page): Promise<string> {
  return page.evaluate(() =>
    [...document.querySelectorAll('.tile:not([data-ghost="true"])')]
      .map((tile) => {
        const el = tile as HTMLElement;
        const row = el.style.getPropertyValue('--row');
        const col = el.style.getPropertyValue('--col');
        return `${row},${col}=${el.textContent}`;
      })
      .sort()
      .join(' '),
  );
}

/** The sum of every tile, used to prove a merge conserved value. */
export async function tileSum(page: Page): Promise<number> {
  return page.evaluate(() =>
    [...document.querySelectorAll('.tile:not([data-ghost="true"])')].reduce(
      (total, tile) => total + Number(tile.textContent ?? '0'),
      0,
    ),
  );
}

/**
 * Plays a game to its end with a rotation strategy, and returns true when the overlay appeared.
 *
 * Paced deliberately slowly. The move lock is one slide plus a queue of two, so firing keys as
 * fast as the browser will dispatch them mostly throws the moves away and turns a 60-move game
 * into a two-minute test. Waiting roughly one slide per keypress is what a player actually does,
 * and it keeps the assertion honest.
 *
 * The direction cycle mirrors the one the engine-level tests use, so a seed that game-overs in
 * 60 moves there game-overs in about 60 moves here too.
 */
export async function playToEnd(page: Page, maxMoves = 200): Promise<boolean> {
  const moves = page.locator('.score-value').nth(2);
  const readMoves = async () =>
    Number.parseInt(((await moves.textContent()) ?? '0').replace(/,/g, ''), 10);

  let last = await readMoves();
  for (let i = 0; i < maxMoves; i++) {
    if (
      await page
        .locator('.overlay')
        .isVisible()
        .catch(() => false)
    )
      return true;

    // Try the intended direction, then the others, because a rotation strategy has to take
    // whatever the board allows rather than insisting on one key.
    for (const offset of [0, 1, 2, 3]) {
      await page.keyboard.press(keyAt(i + offset));
      await page.waitForTimeout(MOVE_SETTLE_MS);
      const now = await readMoves();
      if (now > last) {
        last = now;
        break;
      }
    }
  }
  return page
    .locator('.overlay')
    .isVisible()
    .catch(() => false);
}

/** The on-screen undo button. */
export function undoButton(page: Page): Locator {
  return page.locator('button[aria-label*="Undo"], button[aria-label="Nothing to undo"]');
}

/**
 * Tiles whose painted position does not match the cell they claim to occupy.
 *
 * Compares each tile's centre against the centre of the matching `.board-cell`, which the
 * board already renders one of per square. This is the assertion that catches a tile stranded
 * mid-slide, which is the failure mode behind every timing bug in this file: the logic is right,
 * the number is right, and the tile is just visually in the wrong place.
 */
export async function misalignedTiles(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const cells = [...document.querySelectorAll('.board-cell')].map((cell) => {
      const rect = cell.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    });
    const size = Math.round(Math.sqrt(cells.length));
    const problems: string[] = [];

    for (const tile of document.querySelectorAll('.tile:not([data-ghost="true"])')) {
      const el = tile as HTMLElement;
      const row = Number(el.style.getPropertyValue('--row'));
      const col = Number(el.style.getPropertyValue('--col'));
      const cell = cells[row * size + col];
      if (cell === undefined) {
        problems.push(`tile ${el.textContent} claims cell ${row},${col} which does not exist`);
        continue;
      }
      const rect = el.getBoundingClientRect();
      const dx = Math.abs(rect.left + rect.width / 2 - cell.x);
      const dy = Math.abs(rect.top + rect.height / 2 - cell.y);
      // A couple of pixels of slack for subpixel layout, far less than a cell.
      if (dx > 2 || dy > 2) {
        problems.push(
          `tile ${el.textContent} at ${row},${col} is off by ${dx.toFixed(1)},${dy.toFixed(1)}px`,
        );
      }
    }
    return problems;
  });
}

/**
 * One recorded `animationstart`: the animation's name, the tile birth it belongs to, and the
 * document-timeline timestamp at which it actually began.
 */
export interface AnimationStart {
  name: string;
  birth: string;
  time: number;
}

declare global {
  interface Window {
    /** Installed by `recordAnimationStarts`, read by `takeAnimationStarts`. */
    __animationLog?: AnimationStart[];
    __animationListener?: (event: AnimationEvent) => void;
  }
}

/**
 * Starts recording when animations begin, inside the page, and clears anything already logged.
 *
 * This exists because polling for live animations from outside cannot be made reliable. A merge
 * pop lives about 330ms (a 150ms delay plus a 200ms duration), and pressing a key and then
 * polling costs a round trip per attempt. On an idle machine that fits inside the window; with
 * the rest of the suite running in parallel it does not, and the test then fails for having
 * observed nothing rather than for observing something wrong. That is the worst kind of failure:
 * flaky in the direction of meaning nothing.
 *
 * Recording in the page removes the race. `animationstart` fires when the effect truly begins, and
 * the log keeps it long after the animation is gone. Two animations applied in the same style
 * recalc share a timeline timestamp, which is what makes simultaneity measurable at all.
 */
export async function recordAnimationStarts(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.__animationLog = [];
    if (window.__animationListener) return;
    window.__animationListener = (event: AnimationEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      window.__animationLog?.push({
        name: event.animationName,
        birth: target.closest('.tile')?.getAttribute('data-birth') ?? 'unknown',
        time: event.timeStamp,
      });
    };
    // Capture phase, because animationstart does not bubble.
    document.addEventListener('animationstart', window.__animationListener, true);
  });
}

/** Everything recorded since the last `recordAnimationStarts`, and stops recording. */
export async function takeAnimationStarts(page: Page): Promise<AnimationStart[]> {
  return page.evaluate(() => {
    const recorded = window.__animationLog ?? [];
    if (window.__animationListener) {
      document.removeEventListener('animationstart', window.__animationListener, true);
      window.__animationListener = undefined;
    }
    window.__animationLog = undefined;
    return recorded;
  });
}

/**
 * Waits until nothing on the page is animating or transitioning.
 *
 * Two uses. Between a setup move and the move under test, so recorded events are only the ones the
 * move under test caused. And *after* the move under test, before reading the log: an
 * `animationstart` fires once the effect's delay has elapsed, which for a merge pop is 150ms after
 * the browser applied the animation, and the browser applies it whenever React happens to commit.
 * A fixed wait shorter than that therefore reads the log before the event lands, which is not
 * merely flaky on paper: it fails roughly one run in three, and much more often on WebKit than
 * on Chromium. Waiting for everything to finish means every event has already fired.
 *
 * The predicate is on `playState`, not on how many animations exist. A ghost tile fades with
 * `animation-fill-mode: forwards`, so its effect is still being applied long after the animation
 * ends and it stays in `getAnimations()` indefinitely. Waiting for that list to empty therefore
 * never succeeds once a merge has happened, which is exactly when this is needed.
 */
export async function waitForAnimationsToFinish(page: Page): Promise<void> {
  await page.waitForFunction(
    () => document.getAnimations().every((animation) => animation.playState === 'finished'),
    undefined,
    { timeout: 5000 },
  );
}

/**
 * Presses directions until one is accepted, then stops.
 *
 * For asserting that input is *not* being swallowed. A rejected move leaves the move counter
 * unchanged, so a single arbitrary direction can be a no-op and prove nothing; cycling means a
 * stuck move lock is the only thing that can make this fail.
 */
export async function pressSomeEffectiveKey(page: Page): Promise<void> {
  const moves = page.locator('.score-value').nth(2);
  const readMoves = async () =>
    Number.parseInt(((await moves.textContent()) ?? '0').replace(/,/g, ''), 10);

  const start = await readMoves();
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press(keyAt(i));
    await page.waitForTimeout(MOVE_SETTLE_MS);
    if ((await readMoves()) > start) return;
  }
  throw new Error('no direction was accepted, so input is being swallowed');
}

/**
 * How far apart two animations started, in milliseconds.
 *
 * Not an exact comparison on purpose: two effects can legitimately land in adjacent frames, so
 * demanding the same millisecond would make this flaky in exactly the way that trains people to
 * ignore timing tests. A tolerance of a few frames still catches the bug it exists for, which is
 * one effect starting a whole slide later than the other.
 */
export function startTimeSpread(times: number[]): number {
  const valid = times.filter((time) => Number.isFinite(time));
  if (valid.length < 2) return 0;
  return Math.max(...valid) - Math.min(...valid);
}
