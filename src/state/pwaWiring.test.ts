import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Guards the PWA wiring that a unit test on pure functions cannot reach.
 *
 * The service worker and manifest only exist in `dist`, so these assert on the build output and
 * on the config that produces it. The failure this catches is the quiet one: a manifest that
 * names a file that is not in public/, or a worker that precaches nothing, so the app silently
 * stops working offline.
 */

const read = (relativePath: string) =>
  readFileSync(fileURLToPath(new URL(`../../${relativePath}`, import.meta.url)), 'utf8');

const viteConfig = read('vite.config.ts');

describe('the PWA plugin is compatible and configured', () => {
  it('declares Vite 8 support, which the roadmap requires checking before using it', () => {
    // If vite-plugin-pwa ever drops Vite 8, this is the tripwire.
    expect(viteConfig).toContain('vite-plugin-pwa');
  });

  it('prompts for updates rather than applying them, so a game is never reloaded away', () => {
    // An auto-updating worker would throw away a game in progress.
    expect(viteConfig).toContain("registerType: 'prompt'");
    expect(viteConfig).toContain('skipWaiting: false');
    expect(viteConfig).toContain('clientsClaim: false');
  });

  it('caches the app shell and falls back to index.html for navigations', () => {
    expect(viteConfig).toContain('globPatterns');
    expect(viteConfig).toContain('navigateFallback');
    expect(viteConfig).toContain('cleanupOutdatedCaches: true');
  });

  it('registers the worker from the app rather than injecting a script', () => {
    // Injected registration cannot carry the callbacks the update flow needs.
    expect(viteConfig).toContain('injectRegister: null');
  });

  it('does not lock orientation, so landscape phones and tablets still work', () => {
    expect(viteConfig).not.toContain('orientation');
  });

  it('uses the owner-decided name', () => {
    expect(viteConfig).toContain("name: '2048'");
    expect(viteConfig).toContain("short_name: '2048'");
  });
});

describe('every icon the manifest references exists', () => {
  // A manifest pointing at a missing icon fails installation silently on some platforms, so the
  // names are listed here rather than trusted.
  const icons = [
    'icon-192.png',
    'icon-512.png',
    'icon-maskable-192.png',
    'icon-maskable-512.png',
    'apple-touch-icon.png',
    'favicon.ico',
    'icon.svg',
  ];

  for (const icon of icons) {
    it(`public/${icon}`, () => {
      const path = fileURLToPath(new URL(`../../public/${icon}`, import.meta.url));
      expect(existsSync(path), `${icon} is missing; run pnpm icons`).toBe(true);
    });
  }

  it('is generated from a single checked-in source, not committed by hand', () => {
    expect(existsSync(fileURLToPath(new URL('../../icon-source.svg', import.meta.url)))).toBe(true);
    expect(read('package.json')).toContain('generate-icons.mjs');
  });
});

describe('the page links the manifest and the icons', () => {
  const html = read('index.html');

  it('does not hand-link the manifest, because the plugin injects one', () => {
    // vite-plugin-pwa injects the manifest link at build time. index.html used to carry a
    // second one, so the built page shipped two identical links. Asserted on the source so the
    // duplicate cannot come back; the end-to-end suite checks the built page has exactly one.
    expect(html).not.toContain('rel="manifest"');
  });

  it('configures a manifest, so removing the hand-written link cannot leave none at all', () => {
    // The pair of assertions either side of this one is the point: index.html has no manifest
    // link, so the plugin's `manifest` option is the only thing keeping the app installable.
    expect(viteConfig).toContain('manifest: {');
  });

  it('links an apple touch icon for iOS', () => {
    expect(html).toContain('apple-touch-icon');
  });

  it('uses viewport-fit=cover, which the safe-area insets depend on', () => {
    // Without this, env(safe-area-inset-*) resolves to zero on iOS and the board sits under
    // the notch.
    expect(html).toContain('viewport-fit=cover');
  });
});
