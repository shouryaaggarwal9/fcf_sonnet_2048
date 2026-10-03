import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end configuration.
 *
 * These run against the production build rather than the dev server, because the thing most
 * worth testing is the real bundle: the service worker, the precache, and the hashed assets all
 * behave differently in dev, and "works in dev" is not the claim being made.
 *
 * Only Chromium and WebKit are installed locally. WebKit is included because it is the engine
 * behind iOS Safari, and the install prompt, safe areas, and long-press behaviour are exactly
 * the things that differ there.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],

  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      // A phone-shaped viewport with touch, which is what a swipe actually needs.
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
    },
  ],

  webServer: {
    // --host is pinned because Playwright polls 127.0.0.1, while Vite's default bind of
    // "localhost" can resolve to IPv6 first, leaving the poll waiting on a server that is
    // already running.
    command: 'pnpm preview --port 4173 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
