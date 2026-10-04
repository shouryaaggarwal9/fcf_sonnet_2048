import { expect, test } from '@playwright/test';
import { keyAt, openGame, pressKey, settle } from './helpers';

/**
 * The things that only differ on a real device or a second tab: touch, persistence across a
 * reload, theming, and reduced motion.
 */
test.describe('pointer input', () => {
  // Not restricted to the touch project. The app listens for Pointer Events, so a mouse drag
  // and a finger drag run the same code, and running these everywhere means a regression in the
  // swipe or D-pad is caught on every project rather than only on a phone-shaped one.
  test('a swipe moves the tiles', async ({ page }) => {
    await openGame(page, 5);

    const tiles = page.locator('.tile');
    const before = await tiles.count();
    const box = await page.locator('.board').boundingBox();
    if (box === null) throw new Error('board has no box, so there is nothing to swipe');

    // A drag well past the swipe threshold, in one gesture. Pointer Events drive this, and
    // Playwright's mouse produces them, so the same code path a finger takes is what runs.
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX - 120, startY, { steps: 8 });
    await page.mouse.up();

    await settle(page);
    await expect(page.locator('.score-value').nth(2)).not.toHaveText('0');
    expect(before).toBe(2);
  });

  test('a swipe that starts below the board still moves the tiles', async ({ page }) => {
    // The reach below the board exists because hitting the tiles exactly is a nuisance on a
    // phone. Asserted as a real gesture starting below the board, not by inspecting the
    // pseudo-element, so the hit-testing assumption in App.css is what gets tested.
    await openGame(page, 5);
    const box = await page.locator('.board').boundingBox();
    if (box === null) throw new Error('board has no box, so there is nothing to swipe');

    const startX = box.x + box.width / 2;
    const startY = box.y + box.height + 30;
    // Guard the premise rather than trusting the layout: the point must be below the board and
    // still on screen, otherwise this test would silently pass for the wrong reason.
    expect(startY).toBeGreaterThan(box.y + box.height);
    const viewport = page.viewportSize();
    if (viewport === null) throw new Error('no viewport');
    expect(startY).toBeLessThan(viewport.height);

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX - 120, startY, { steps: 8 });
    await page.mouse.up();

    await settle(page);
    await expect(page.locator('.score-value').nth(2)).not.toHaveText('0');
  });

  test('a swipe beside the board does nothing, so the reach stays inside its width', async ({
    page,
  }) => {
    // The reach extends downwards only. Widening it sideways would turn the whole page into a
    // swipe target, which is what makes a gesture ambiguous.
    await openGame(page, 5);
    const box = await page.locator('.board').boundingBox();
    if (box === null) throw new Error('board has no box');

    const startX = box.x - 24;
    const startY = box.y + box.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX - 120, startY, { steps: 8 });
    await page.mouse.up();

    await settle(page);
    await expect(page.locator('.score-value').nth(2)).toHaveText('0');
  });

  test('the direction pad plays a move with a single tap', async ({ page }) => {
    await openGame(page, 5);
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByLabel('Show on-screen arrows').check();
    await page.keyboard.press('Escape');

    const pad = page.locator('.dpad');
    await expect(pad).toBeVisible();
    // The pad sits inside the reach below the board, so this also proves the reach does not
    // swallow taps meant for the controls below it.
    await pad.locator('.dpad-left').click();
    await settle(page);
    await expect(page.locator('.score-value').nth(2)).not.toHaveText('0');
  });
});

test.describe('persistence', () => {
  test('the game survives a reload', async ({ page }) => {
    await openGame(page, 41);
    await pressKey(page, 'ArrowLeft');
    const before = await page.locator('.score-value').nth(2).textContent();

    await page.reload();
    await expect(page.locator('.board')).toBeVisible();
    await expect(page.locator('.score-value').nth(2)).toHaveText(before ?? '');
  });

  test('undo survives a reload', async ({ page }) => {
    await openGame(page, 43);
    await pressKey(page, 'ArrowLeft');
    await expect(page.getByRole('button', { name: /Undo last move/ })).toBeEnabled();

    await page.reload();
    await expect(page.getByRole('button', { name: /Undo last move/ })).toBeEnabled();
  });

  test('the best score never goes down, even after a restart', async ({ page }) => {
    await openGame(page, 45);
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press(keyAt(i));
      await settle(page);
    }
    const best = await page.locator('.score-value').nth(1).textContent();

    await page.getByRole('button', { name: 'New game', exact: true }).first().click();
    const dialog = page.locator('dialog[open]');
    if (await dialog.isVisible().catch(() => false)) {
      await dialog.getByRole('button', { name: 'New game' }).click();
    }
    await expect(page.locator('.score-value').nth(0)).toHaveText('0');
    await expect(page.locator('.score-value').nth(1)).toHaveText(best ?? '');
  });
});

test.describe('theming', () => {
  test('the toggle switches theme and remembers it', async ({ page }) => {
    await openGame(page, 1);
    const root = page.locator('html');
    const initial = await root.getAttribute('data-theme');

    await page.getByRole('button', { name: /Switch to .* theme/ }).click();
    await expect(root).not.toHaveAttribute('data-theme', initial ?? '');

    const chosen = await root.getAttribute('data-theme');
    await page.reload();
    // No flash of the wrong theme: the attribute is right on the very first paint, which is
    // what the inline boot script in index.html is for.
    await expect(root).toHaveAttribute('data-theme', chosen ?? '');
  });

  test('the toggle states the action it will take', async ({ page }) => {
    await openGame(page, 1);
    const toggle = page.getByRole('button', { name: /Switch to (dark|light) theme/ });
    const label = (await toggle.getAttribute('aria-label')) ?? '';
    const current = await page.locator('html').getAttribute('data-theme');
    expect(label).toContain(current === 'dark' ? 'light' : 'dark');
  });

  test('colour contrast meets AA for the tiles in both themes', async ({ page }) => {
    // Contrast is asserted against the stylesheets in unit tests too. This checks the computed
    // result, which is what a player actually gets, including anything the cascade changes.
    for (const theme of ['light', 'dark'] as const) {
      await openGame(page, 1);
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
      const worst = await page.evaluate(() => {
        const lin = (c: number) => {
          const v = c / 255;
          return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        };
        const lum = (rgb: string) => {
          const [r, g, b] = rgb.match(/\d+/g)?.map(Number) ?? [0, 0, 0];
          return 0.2126 * lin(r ?? 0) + 0.7152 * lin(g ?? 0) + 0.0722 * lin(b ?? 0);
        };
        const tiles = [...document.querySelectorAll('.tile-inner')];
        return tiles.reduce((worstSoFar, tile) => {
          const s = getComputedStyle(tile);
          const hi = Math.max(lum(s.backgroundColor), lum(s.color));
          const lo = Math.min(lum(s.backgroundColor), lum(s.color));
          return Math.min(worstSoFar, (hi + 0.05) / (lo + 0.05));
        }, Infinity);
      });
      expect(worst, `worst tile contrast in ${theme}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('honours the OS preference', async ({ page }) => {
    await openGame(page, 1);
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduce');
    // The slide transition is what carries the movement, so its absence is the assertion.
    const duration = await page
      .locator('.tile')
      .first()
      .evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(['0s', '0ms']).toContain(duration);
  });

  test('still plays, because reduced motion is not reduced play', async ({ page }) => {
    await openGame(page, 7);
    await pressKey(page, 'ArrowLeft');
    await expect(page.locator('.score-value').nth(2)).not.toHaveText('0');
  });

  test('the in-app override wins over the OS', async ({ page }) => {
    await openGame(page, 1);
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduce');

    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByLabel('Full').check();
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'full');
  });
});

test.describe('zoom', () => {
  test('pinch zoom is blocked, since the game has nothing to magnify', async ({ page }) => {
    // A zoomed page turns the next swipe into browser back/forward navigation, which is the
    // bug this prevents. Two layers, because engines honour different ones: the meta tag and
    // touch-action.
    await openGame(page, 1);
    const meta = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(meta).toContain('maximum-scale=1');
    expect(meta).toContain('user-scalable=no');

    // `touch-action` is where the gesture is actually handled. `manipulation` would still allow
    // pinch-zoom, since it is shorthand for pan-x pan-y pinch-zoom.
    const rootTouchAction = await page.evaluate(() => getComputedStyle(document.body).touchAction);
    expect(rootTouchAction).not.toContain('pinch-zoom');
  });

  test('the page can still be scrolled, so blocking zoom costs nothing here', async ({ page }) => {
    // touch-action pan-x pan-y keeps panning. Only pinch-zoom was dropped; if this ever reads
    // as "none" then a page taller than the viewport would trap the player.
    await openGame(page, 1);
    const rootTouchAction = await page.evaluate(() => getComputedStyle(document.body).touchAction);
    expect(rootTouchAction).toBe('pan-x pan-y');
  });
});

test.describe('offline', () => {
  // Skipped on WebKit, and this one is a tooling limit rather than a choice. Measured directly:
  // on a page with no service worker at all, `context.setOffline(true)` followed by
  // `page.reload()` still fails with "WebKit encountered an internal error" in Playwright's
  // WebKit build. The app cannot fix that, and faking it with route interception would not test
  // the service worker at all, since intercepted routes are not what the worker fetches.
  //
  // The gap this leaves is real and worth naming: offline play in actual Safari is unverified.
  // The worker registers and takes control in WebKit, so the wiring is right; the cache-hit path
  // is the part only a real device can confirm.
  test.skip(
    ({ browserName }) => browserName === 'webkit',
    'setOffline + reload crashes Playwright WebKit',
  );

  test('the app loads from the service worker with the network gone', async ({ page, context }) => {
    await openGame(page, 1);

    // Two visits, on purpose. The worker is configured with clientsClaim: false so that it never
    // takes over a page mid-game, which also means the very first visit is not controlled by
    // it. Offline therefore kicks in from the second visit onwards, and that is exactly what a
    // player gets: install, come back later, and the game opens without a network.
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
    await page.reload();
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, {
      timeout: 15000,
    });

    await context.setOffline(true);
    await page.reload();

    await expect(page.locator('.board')).toBeVisible();
    await pressKey(page, 'ArrowLeft');
    await expect(page.locator('.score-value').nth(2)).not.toHaveText('0');
    await context.setOffline(false);
  });
});
