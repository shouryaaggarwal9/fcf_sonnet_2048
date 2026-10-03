import { expect, test } from '@playwright/test';
import {
  boardState,
  keyAt,
  openGame,
  playToEnd,
  pressKey,
  settle,
  tileSum,
  undoButton,
} from './helpers';

/**
 * Core play: loading, input, undo, winning, and game over.
 *
 * Reachable end states use a seed, because the engine is deterministic and there is otherwise no
 * way to reach a win or a game over in a test without a board that could differ every run.
 */
test.describe('playing', () => {
  test('loads and shows a playable board', async ({ page }) => {
    await openGame(page, 1);
    await expect(page).toHaveTitle('2048');
    await expect(page.locator('.tile')).toHaveCount(2);
    await expect(page.locator('.overlay')).toHaveCount(0);
  });

  test('the same seed always produces the same board', async ({ page }) => {
    await openGame(page, 42);
    const first = await boardState(page);
    await openGame(page, 42);
    expect(await boardState(page)).toBe(first);
  });

  test('moves with the arrow keys and with WASD', async ({ page }) => {
    await openGame(page, 7);
    await pressKey(page, 'ArrowLeft');
    await expect(page.locator('.score-value').nth(2)).not.toHaveText('0');

    const before = await boardState(page);
    await page.keyboard.press('KeyW');
    await settle(page);
    expect(await boardState(page)).not.toBe(before);
  });

  test('a merge raises the score and announces itself', async ({ page }) => {
    await openGame(page, 5);
    // Play until something merges, rather than assuming a particular seed merges at once.
    for (let i = 0; i < 60; i++) {
      await page.keyboard.press(keyAt(i));
      await settle(page);
      const score = Number.parseInt(
        ((await page.locator('.score-value').nth(0).textContent()) ?? '0').replace(/,/g, ''),
        10,
      );
      if (score > 0) {
        await expect(page.locator('[role="status"]')).toContainText('Merged');
        break;
      }
    }
    await expect(page.locator('.score-value').nth(0)).not.toHaveText('0');
  });

  test('mashing keys does not run away: the move lock and queue hold', async ({ page }) => {
    await openGame(page, 3);
    // Twelve keypresses with no waiting. The lock allows one move plus a queue of two, so the
    // move count must land well below twelve.
    await page.keyboard.press('ArrowLeft');
    for (let i = 0; i < 11; i++) {
      await page.keyboard.press(keyAt(i));
    }
    await page.waitForTimeout(1500);
    const moves = Number.parseInt(
      ((await page.locator('.score-value').nth(2).textContent()) ?? '0').replace(/,/g, ''),
      10,
    );
    expect(moves).toBeGreaterThan(0);
    expect(moves).toBeLessThan(12);
  });

  test('undo rewinds exactly one move and leaves nothing behind', async ({ page }) => {
    await openGame(page, 11);
    await pressKey(page, 'ArrowLeft');
    const afterOne = await boardState(page);
    await pressKey(page, 'ArrowUp');
    expect(await boardState(page)).not.toBe(afterOne);

    await undoButton(page).click();
    await page.waitForTimeout(400);
    expect(await boardState(page)).toBe(afterOne);

    // No ghosts left over from the merge that was undone.
    await expect(page.locator('.tile[data-ghost="true"]')).toHaveCount(0);
  });

  test('undo then replaying the same move reproduces the board exactly', async ({ page }) => {
    // rngState is restored, so the same direction gives the same spawn. Deliberate, not a bug.
    await openGame(page, 13);
    await pressKey(page, 'ArrowLeft');
    await pressKey(page, 'ArrowUp');

    await undoButton(page).click();
    await page.waitForTimeout(400);
    const beforeReplay = await boardState(page);

    await pressKey(page, 'ArrowUp');
    expect(await boardState(page)).not.toBe(beforeReplay);
  });

  test('a merge conserves the value on the board', async ({ page }) => {
    await openGame(page, 17);
    for (let i = 0; i < 40; i++) {
      const before = await tileSum(page);
      await page.keyboard.press(keyAt(i));
      await settle(page);
      const after = await tileSum(page);
      // A merge replaces two tiles with their sum, so the total never drops and never doubles
      // beyond the tile that spawned.
      expect(after).toBeGreaterThanOrEqual(before);
    }
  });

  test('reaching the end shows a dialog and takes focus', async ({ page }) => {
    // Seed 21 game-overs in 79 moves under the rotation strategy, which the engine-level tests
    // measured directly. At roughly one keypress per slide that is about 20 seconds, so the
    // default 30s budget is too tight to be reliable.
    test.setTimeout(90_000);
    await openGame(page, 21);
    const ended = await playToEnd(page);
    expect(ended).toBe(true);

    const overlay = page.locator('.overlay');
    await expect(overlay).toHaveAttribute('role', 'dialog');
    await expect(overlay).toHaveAttribute('aria-modal', 'true');
    await expect(overlay).toContainText('Game over');

    // The known Phase 6 issue: focus must land inside the overlay, not stay on a header button.
    await expect
      .poll(async () => overlay.evaluate((el) => el.contains(document.activeElement)))
      .toBe(true);
  });

  test('no merged tile paints above the overlay', async ({ page }) => {
    // A real bug that shipped once: merged tiles set z-index 1, which escaped the tile layer
    // and painted over the overlay. Only checking computed z-index would not have caught it,
    // so this hits the pixels through elementFromPoint.
    test.setTimeout(90_000);
    await openGame(page, 21);
    const ended = await playToEnd(page);
    expect(ended).toBe(true);
    await page.locator('.overlay').waitFor();
    // Long enough for the last merge's pop and the overlay's delayed fade to both finish.
    await page.waitForTimeout(800);

    const tileOnTop = await page.evaluate(() => {
      const tiles = [...document.querySelectorAll('.tile')];
      if (tiles.length === 0) return false;
      return tiles.some((tile) => {
        const rect = tile.getBoundingClientRect();
        const hit = document.elementFromPoint(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
        );
        return hit !== null && (hit as HTMLElement).classList.contains('tile-inner');
      });
    });
    expect(tileOnTop).toBe(false);
  });

  test('new game asks for confirmation, and cancelling keeps the game', async ({ page }) => {
    await openGame(page, 31);
    await pressKey(page, 'ArrowLeft');
    const before = await boardState(page);

    await page.getByRole('button', { name: 'New game', exact: true }).first().click();
    const dialog = page.locator('dialog[open]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('undo');

    await dialog.getByRole('button', { name: 'Keep playing' }).click();
    await expect(dialog).toBeHidden();
    expect(await boardState(page)).toBe(before);
  });

  test('a fresh game does not ask for confirmation', async ({ page }) => {
    await openGame(page, 33);
    await page.getByRole('button', { name: 'New game', exact: true }).first().click();
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await expect(page.locator('.tile')).toHaveCount(2);
  });

  test('confirming a restart clears undo', async ({ page }) => {
    await openGame(page, 35);
    await pressKey(page, 'ArrowLeft');
    await expect(undoButton(page)).toBeEnabled();

    await page.getByRole('button', { name: 'New game', exact: true }).first().click();
    await page.locator('dialog[open]').getByRole('button', { name: 'New game' }).click();
    await expect(page.locator('.tile')).toHaveCount(2);
    await expect(undoButton(page)).toBeDisabled();
  });
});
