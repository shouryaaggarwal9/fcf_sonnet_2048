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
