import { expect, test } from '@playwright/test';
import { openGame, pressKey } from './helpers';

/**
 * The deployed security headers, checked against a server that actually sends them.
 *
 * `vite preview` reads the CSP out of vercel.json, so this suite runs under the real policy
 * rather than a copy of it. That matters because the failure mode of a wrong CSP is quiet: the
 * page still renders, and the symptom is a console full of violations, a theme that never
 * applies before first paint, or a service worker that silently never registers. The unit test in
 * src/state/security.test.ts checks the policy is well-formed and the hash is current; this file
 * checks the app still works while it is switched on, and that the header is really being sent.
 */
test.describe('security headers', () => {
  test('the preview server really sends the policy, so this suite means something', async ({
    page,
  }) => {
    // Guards the guard. If the header stopped being applied, every other test here would still
    // pass while checking nothing at all.
    const response = await page.goto('/?seed=1');
    const csp = response?.headers()['content-security-policy'] ?? '';
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("'sha256-");
    expect(response?.headers()['x-content-type-options']).toBe('nosniff');
  });

  test('the app loads and plays with no console errors', async ({ page }) => {
    // CSP violations are reported to the console, so this is what catches an inline script or
    // an off-origin asset sneaking in later.
    const problems: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(message.text());
    });
    page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));

    await openGame(page, 7);
    await pressKey(page, 'ArrowLeft');
    await pressKey(page, 'ArrowUp');

    expect(problems).toEqual([]);
  });

  test('the theme still applies before React mounts, which is why the script is inline', async ({
    page,
  }) => {
    // The whole reason the boot script exists is to set data-theme before the first paint. If
    // the hash were stale the inline script would be blocked and this would never happen, which
    // is a silent failure: the app works, it just flashes the wrong theme on every load.
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/?seed=1');
    expect(await page.locator('html').getAttribute('data-theme')).toBe('dark');
  });
});
