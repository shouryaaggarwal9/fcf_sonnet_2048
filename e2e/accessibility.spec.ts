import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { openGame } from './helpers';

/**
 * Accessibility, asserted with axe in both themes.
 *
 * axe checks semantics: roles, names, contrast, focus order. It cannot see paint order, which is
 * why the merged-tile-above-the-overlay bug survived every other gate, and why that one is
 * checked in play.spec.ts by hit-testing instead.
 */
test.describe('accessibility', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`has no axe violations in the ${theme} theme`, async ({ page }) => {
      await openGame(page, 1);
      await page.evaluate((value) => {
        document.documentElement.setAttribute('data-theme', value);
      }, theme);

      const results = await new AxeBuilder({ page })
        // The tiles are inside a role="img" board with a label: they are a picture of numbers
        // and are not meant to be walked individually, so axe is right to complain that they
        // carry no text of their own.
        .exclude('.board-tiles')
        .analyze();

      expect(results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length} nodes)`)).toEqual(
        [],
      );
    });
  }

  test('the board is labelled and described for a screen reader', async ({ page }) => {
    await openGame(page, 1);
    const board = page.locator('.board');
    await expect(board).toHaveAttribute('role', 'img');
    const label = await board.getAttribute('aria-label');
    expect(label).toContain('4 by 4');
    expect(label).toContain('arrow keys');
    expect(label).toContain('swipe');
    expect(label).toContain('undo');
  });

  test('a polite live region exists and is empty before anything happens', async ({ page }) => {
    await openGame(page, 1);
    const live = page.locator('[role="status"]');
    await expect(live).toHaveAttribute('aria-live', 'polite');
    await expect(live).toHaveText('');
  });

  test('every interactive control has an accessible name', async ({ page }) => {
    await openGame(page, 1);
    // Resolved the way a screen reader does, and deliberately not with `??` chaining: an input
    // has textContent "" rather than null, so a chain short-circuits and never reaches .labels,
    // which is exactly how this test first reported seven perfectly good radios as unnamed.
    const unnamed = await page.evaluate(() =>
      [...document.querySelectorAll('button, input')]
        .filter((el) => {
          const aria = el.getAttribute('aria-label');
          if (aria !== null) return aria.trim() === '';
          const text = el.textContent?.trim() ?? '';
          if (text !== '') return false;
          const labelledBy = el.getAttribute('aria-labelledby');
          if (labelledBy !== null) {
            return !labelledBy
              .split(/\s+/)
              .some((id) => (document.getElementById(id)?.textContent ?? '').trim() !== '');
          }
          const labels = (el as HTMLInputElement).labels;
          return !(labels && [...labels].some((l) => (l.textContent ?? '').trim() !== ''));
        })
        .map((el) => el.outerHTML.slice(0, 80)),
    );
    expect(unnamed).toEqual([]);
  });

  test('the dialogs are real dialogs with an accessible name', async ({ page }) => {
    await openGame(page, 1);
    for (const name of ['How to play', 'Settings']) {
      await page.getByRole('button', { name }).click();
      const dialog = page.locator('dialog[open]');
      await expect(dialog).toBeVisible();
      // A dialog with no accessible name is announced as nothing at all.
      await expect(dialog).toHaveAttribute('aria-labelledby', /.+/);
      await dialog.getByRole('button', { name: 'Close' }).click();
      await expect(dialog).toBeHidden();
    }
  });

  test('Escape closes a dialog', async ({ page }) => {
    await openGame(page, 1);
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.locator('dialog[open]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('dialog[open]')).toHaveCount(0);
  });

  test('focus returns to the control that opened a dialog', async ({ page }) => {
    await openGame(page, 1);
    const help = page.getByRole('button', { name: 'How to play' });

    // Opened with the keyboard, on purpose. WebKit blurs a button on mousedown, because Safari
    // does not focus buttons when they are clicked, so with a mouse the opener genuinely is
    // <body> and there is nothing meaningful to restore to. A keyboard player tabs to the button
    // and presses Enter, the button keeps focus throughout, and returning it afterwards is the
    // behaviour that matters. Verified in both engines by running this on all three projects.
    await help.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('dialog[open]')).toBeVisible();
    await expect(page.locator('dialog[open]').getByRole('button', { name: 'Close' })).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await expect(help).toBeFocused();
  });

  test('focus returns to the opener when the Close button is used', async ({ page }) => {
    await openGame(page, 1);
    const help = page.getByRole('button', { name: 'How to play' });
    await help.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('dialog[open]')).toBeVisible();

    await page.locator('dialog[open]').getByRole('button', { name: 'Close' }).click();
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await expect(help).toBeFocused();
  });

  test('touch targets are large enough for a thumb', async ({ page }) => {
    await openGame(page, 1);
    const tooSmall = await page.evaluate(() =>
      [...document.querySelectorAll('button')]
        .filter((el) => {
          const rect = el.getBoundingClientRect();
          // The board's own tiles are not controls; every button is.
          return rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44);
        })
        .map(
          (el) =>
            `${el.getAttribute('aria-label') ?? el.textContent}: ${el.getBoundingClientRect().width}x${el.getBoundingClientRect().height}`,
        ),
    );
    expect(tooSmall).toEqual([]);
  });

  test('the page declares a language and a title', async ({ page }) => {
    await openGame(page, 1);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page).toHaveTitle('2048');
  });

  test('links the manifest exactly once, which an installable app needs', async ({ page }) => {
    await openGame(page, 1);
    // Two shipped once: vite-plugin-pwa injects one, and index.html had one too. A duplicate is
    // not an error, but it means one of them is dead weight nobody is maintaining.
    await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
  });
});
