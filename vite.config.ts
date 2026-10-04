import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

/**
 * The production Content-Security-Policy, read from vercel.json rather than written out again.
 *
 * The point is that the end-to-end suite then runs against the real policy. A CSP that is only
 * ever deployed is a CSP that is never tested, and the failure mode is silent and confusing: the
 * theme silently stops applying, or the service worker fails to register, or the app is blank
 * with a console full of violations nobody reads. vercel.json stays the single source of truth.
 *
 * Only the security headers are applied. Cache-Control is not, because it cannot break the app
 * and a preview server is not the deployment target.
 */
function previewSecurityHeaders(): Record<string, string> {
  const config = JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf8')) as {
    headers?: { source: string; headers?: { key: string; value: string }[] }[];
  };
  const catchAll = (config.headers ?? []).find((entry) => entry.source === '/(.*)');
  const out: Record<string, string> = {};
  for (const header of catchAll?.headers ?? []) {
    // Cache-Control here would be Vercel's business, not the preview server's.
    if (header.key === 'Cache-Control') continue;
    out[header.key] = header.value;
  }
  return out;
}

// https://vite.dev/config/
export default defineConfig({
  preview: {
    headers: previewSecurityHeaders(),
  },
  plugins: [
    react(),
    VitePWA({
      // The update is offered, never taken. Reloading mid-game would throw the board away, so
      // the app shows a toast and the player decides. See src/ui/UpdateToast.tsx.
      registerType: 'prompt',
      injectRegister: null, // registration is done in src/pwa.ts, not injected into the page
      // The saved game is plain JSON in localStorage, not a request, so offline play is complete
      // as long as the shell is cached.
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: false, // do not steal open tabs from the running version
        skipWaiting: false, // an update waits for the player to accept it
      },
      manifest: {
        id: '/',
        name: '2048',
        short_name: '2048',
        description: 'Join matching tiles to reach 2048.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        // Deliberately not locked to portrait: the layout adapts, and forcing it would stop a
        // player using a landscape phone or a tablet.
        categories: ['games', 'puzzle'],
        // The light values. index.html already sends a theme-color per prefers-color-scheme, and
        // the manifest's own colour is what launchers show before CSS has loaded.
        theme_color: '#faf8ef',
        background_color: '#faf8ef',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icon-maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  test: {
    // The default for this project. Engine, state, and pure logic tests run in node, which is
    // both faster and a better check: nothing can reach for a DOM by accident.
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
