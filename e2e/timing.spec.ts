import { expect, test } from '@playwright/test';
import {
  keyAt,
  misalignedTiles,
  openGame,
  pressKey,
  pressSomeEffectiveKey,
  recordAnimationStarts,
  settle,
  startTimeSpread,
  takeAnimationStarts,
  waitForAnimationsToFinish,
} from './helpers';

/**
 * How close together two `animationstart` events must be to count as simultaneous.
 *
 * Two effects applied in the same style recalc share a document-timeline timestamp exactly, so
 * the real spread is zero. This is slack rather than a claim: on a loaded machine two events can
 * be dispatched in adjacent frames, and a test that demands the same millisecond would fail for
 * that alone. Two frames is tight enough to still catch the bug these exist for, which is one
 * effect waiting out a whole extra slide.
 */
const FRAME_TOLERANCE_MS = 34;

/**
 * The timing edge cases Phase 4.6 listed and Phase 8 did not cover.
 *
 * All six are timing bugs, which is the class of defect that never shows up in a unit test and
 * only reproduces on a real device, where it gets misdiagnosed as "the animation feels off".
 * These assert the mechanism rather than a vibe: which animations exist, when they started, and
 * where tiles actually ended up.
 *
 * The board that makes two merges possible is reached by really playing rather than by injecting
 * one. Seed 1 with left, right, up leaves
 *
 *     2 . . 2
 *     . . . 4
 *     2 . . 2
 *     . . . .
 *
 * and one more swipe left merges two pairs at once, for a gain of 8, while also spawning a tile.
 * Verified against the engine rather than reasoned about, so the sequence below is exact.
 */
const DOUBLE_MERGE_SETUP = ['ArrowLeft', 'ArrowRight', 'ArrowUp'] as const;

async function reachDoubleMerge(page: import('@playwright/test').Page): Promise<void> {
  await openGame(page, 1);
  for (const key of DOUBLE_MERGE_SETUP) await pressKey(page, key);
  // Drain the setup move's effects, so the only animations present are the ones the move under
  // test causes. Otherwise the previous move's spawn is still inside its 330ms window and gets
  // counted as part of this one.
  await waitForAnimationsToFinish(page);
}

test.describe('animation edge cases', () => {
  test('page load shows no animation at all', async ({ page }) => {
    // A restored board is built with birth "initial", which no CSS rule matches, so a restored
    // game appears rather than animating in. A page load that animated would replay the whole
    // board every time the tab is reopened, which reads as a flicker.
    await openGame(page, 7);
    const playing = await page.evaluate(() =>
      [...document.querySelectorAll('.tile-inner')].map((inner) => {
        const style = getComputedStyle(inner);
        return { name: style.animationName, delay: style.animationDelay, opacity: style.opacity };
      }),
    );
    expect(playing).toHaveLength(2);
    for (const tile of playing) {
      expect(tile.name, `animation-name on load`).toBe('none');
    }
    // Visible immediately: if anything were mid-animation with fill-mode backwards, it would be
    // transparent right now, which is the other half of "no animation".
    for (const tile of playing) {
      expect(Number(tile.opacity), 'opacity on load').toBe(1);
    }
  });

  test('a reloaded game shows no animation either', async ({ page }) => {
    // The restore path rather than the fresh-load path, because those are different code:
    // one reads a save, the other does not.
    await openGame(page, 7);
    await pressKey(page, 'ArrowLeft');
    await page.reload();
    await expect(page.locator('.board')).toBeVisible();

    const names = await page.evaluate(() =>
      [...document.querySelectorAll('.tile-inner')].map(
        (inner) => getComputedStyle(inner).animationName,
      ),
    );
    expect(names.length).toBeGreaterThan(2);
    for (const name of names) expect(name).toBe('none');
    expect(await misalignedTiles(page)).toEqual([]);
  });

  test('a new game started mid-slide settles correctly and unlocks input at once', async ({
    page,
  }) => {
    // The race this covers: a restart lands while a slide is still transitioning. The risk is
    // that the old tiles' transitions keep running, or that the move lock survives the restart
    // and swallows the player's first input.
    await openGame(page, 3);

    // Start a slide, then restart without waiting for it to finish. The confirm dialog is part
    // of the path a real player takes once they have made a move.
    await page.keyboard.press('ArrowLeft');
    await page.getByRole('button', { name: 'New game', exact: true }).first().click();
    const dialog = page.locator('dialog[open]');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'New game' }).click();

    // A fresh board: two tiles, and they are the only tiles.
    await expect(page.locator('.tile:not([data-ghost="true"])')).toHaveCount(2);

    // The previous board must be cleaned up even though its dissolve never got to finish,
    // and the new one must be geometrically correct.
    await page.waitForTimeout(600);
    await expect(page.locator('.board-tiles-outgoing')).toHaveCount(0);
    expect(await misalignedTiles(page)).toEqual([]);

    // The move lock has to have been reset with the game. If it was not, every direction is
    // swallowed and the player has to tap twice after every restart. Which directions are
    // accepted on a fresh board is not fixed, so all four are tried.
    await pressSomeEffectiveKey(page);
    await expect(page.locator('.score-value').nth(2)).not.toHaveText('0');
  });

  test('restarts animate their two tiles in, unlike a page load', async ({ page }) => {
    // The counterpart to the first test, and the reason birth is modelled at all: a restart is
    // a deliberate act by the player and gets a "fresh" birth that animates immediately, while a
    // load is not and does not.
    await openGame(page, 3);
    await recordAnimationStarts(page);
    await page.getByRole('button', { name: 'New game', exact: true }).first().click();
    await waitForAnimationsToFinish(page);
    const events = await takeAnimationStarts(page);

    const spawns = events.filter((event) => event.birth === 'fresh');
    expect(spawns).toHaveLength(2);
    for (const spawn of spawns) expect(spawn.name).toBe('tile-spawn');
    // They begin together, unlike a load where nothing animates at all.
    expect(startTimeSpread(spawns.map((event) => event.time))).toBeLessThan(FRAME_TOLERANCE_MS);
  });

  test('a line of 2s gives two pops that start at the same instant', async ({ page }) => {
    await reachDoubleMerge(page);

    await recordAnimationStarts(page);
    await page.keyboard.press('ArrowLeft');
    await waitForAnimationsToFinish(page);
    const events = await takeAnimationStarts(page);

    const pops = events.filter((event) => event.name === 'tile-merge');
    expect(pops).toHaveLength(2);
    // The whole point: one gesture, two pops, together. Not one now and one later.
    expect(startTimeSpread(pops.map((event) => event.time))).toBeLessThan(FRAME_TOLERANCE_MS);

    // And the board really did merge twice: a gain of 8 is two pairs of 2s.
    await expect(page.locator('.score-value').nth(0)).toHaveText('8');
    expect(await misalignedTiles(page)).toEqual([]);
  });

  test('a merge and a spawn begin at the same instant, not one after the other', async ({
    page,
  }) => {
    // Every merge spawns a tile, so this is the ordinary case rather than a rare one. Both
    // effects wait out the slide with animation-delay, which is what keeps the board from
    // looking like it is already reacting before the tiles land.
    await reachDoubleMerge(page);

    await recordAnimationStarts(page);
    await page.keyboard.press('ArrowLeft');
    await waitForAnimationsToFinish(page);
    const events = await takeAnimationStarts(page);

    const pops = events.filter((event) => event.name === 'tile-merge');
    const spawns = events.filter((event) => event.name === 'tile-spawn');
    expect(pops).toHaveLength(2);
    expect(spawns).toHaveLength(1);

    // A merge and the spawn it caused land together. If these ever drift apart, the spawn
    // appears before or after the tiles it accompanies, which reads as a glitch.
    const together = [...pops, ...spawns].map((event) => event.time);
    expect(startTimeSpread(together)).toBeLessThan(FRAME_TOLERANCE_MS);
  });

  test('a resize mid-slide leaves every tile in its cell', async ({ page }) => {
    // Tiles are positioned with percentage transforms, so a resize changes the distance they
    // have to travel mid-transition. The risk is a tile settling at a stale pixel offset, or a
    // transition being cancelled by the relayout and stranding a tile between cells.
    await openGame(page, 21);
    for (let i = 0; i < 6; i++) {
      await pressKey(page, keyAt(i));
    }

    const size = page.viewportSize();
    if (size === null) throw new Error('no viewport');

    await page.keyboard.press('ArrowRight');
    // Resize during the slide rather than after it.
    await page.setViewportSize({ width: size.width - 120, height: size.height - 60 });
    await settle(page);
    await page.setViewportSize(size);
    await settle(page);

    expect(await misalignedTiles(page)).toEqual([]);
    // Still playable after being resized mid-gesture.
    await pressKey(page, 'ArrowDown');
    await expect(page.locator('.score-value').nth(2)).not.toHaveText('0');
  });
});

test.describe('backgrounded tab (Chromium only)', () => {
  // A backgrounded tab does not run CSS animations, which is why Board.tsx cleans up the
  // outgoing layer on a timer as well as on animationend. Reproducing that needs a real freeze
  // rather than a faked property: overriding document.hidden does not stop the browser running
  // animations, so it would test nothing. CDP can genuinely freeze the renderer, but
  // Page.setWebLifecycleState is Chromium only, so this is skipped elsewhere rather than
  // weakened into something that passes without proving anything.
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'Page.setWebLifecycleState is Chromium only',
  );

  test('a hidden and restored tab leaves no tile stranded', async ({ page }) => {
    await openGame(page, 7);
    await pressKey(page, 'ArrowLeft');

    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Page.setWebLifecycleState', { state: 'frozen' });
    // Thaw. Timers and animations resume, which is when a stranded tile would show itself.
    await cdp.send('Page.setWebLifecycleState', { state: 'active' });
    await settle(page);

    expect(await misalignedTiles(page)).toEqual([]);
    await expect(page.locator('.board-tiles-outgoing')).toHaveCount(0);

    // And the game still takes input, which is the part a player would actually notice.
    await pressKey(page, 'ArrowUp');
    await expect(page.locator('.score-value').nth(2)).not.toHaveText('0');
  });
});
