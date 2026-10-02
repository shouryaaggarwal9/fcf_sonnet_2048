/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { THEME_ATTRIBUTE } from '../ui/theme';
import { STORAGE_KEY } from './persistence';

/**
 * The inline script in index.html cannot import from src, so it repeats a few constants by
 * hand. That is unavoidable for a before-first-paint script, but it can silently rot: if the
 * storage key changes and the copy in index.html does not, the theme stops persisting and the
 * only symptom is a flash on reload. These tests pin the copies together.
 *
 * `node:fs` is used rather than import.meta.glob because Vite's CSS plugin intercepts a `?raw`
 * import of a .css file and returns an empty string. The reference directive above is scoped
 * to this file only; adding "node" to tsconfig.app's types would let application code reach
 * for Node APIs that do not exist in a browser.
 */
function read(repoRelativePath: string): string {
  return readFileSync(new URL(`../../${repoRelativePath}`, import.meta.url), 'utf8');
}

/** CSS with block comments removed, so prose about a query is not read as the query itself. */
function cssRules(repoRelativePath: string): string {
  return read(repoRelativePath).replace(/\/\*[\s\S]*?\*\//g, '');
}

const html = read('index.html');
const script = html.slice(html.indexOf('<script>'), html.indexOf('</script>'));

describe('theme boot script', () => {
  it('is found in the html, so these assertions are not passing on an empty string', () => {
    // Guards every other assertion in this file: an empty fixture would match "does not
    // contain" trivially and make the suite meaningless.
    expect(script.length).toBeGreaterThan(100);
  });

  it('lives inline in the head, so it runs before the first paint', () => {
    expect(html.indexOf('<script>')).toBeGreaterThan(-1);
    expect(html.indexOf('<script>')).toBeLessThan(html.indexOf('<body>'));
  });

  it('reads the same storage key the app writes', () => {
    expect(script).toContain(`'${STORAGE_KEY}'`);
  });

  it('sets the same attribute the app reads', () => {
    expect(THEME_ATTRIBUTE).toBe('data-theme');
    expect(script).toContain(`'${THEME_ATTRIBUTE}'`);
  });

  it('agrees with the app on every legal theme value', () => {
    for (const theme of ['light', 'dark', 'system']) {
      expect(script).toContain(`'${theme}'`);
    }
  });

  it('uses the same media query as the app', () => {
    expect(script).toContain('(prefers-color-scheme: dark)');
  });

  it('is fully wrapped in try/catch, because storage throws in private mode', () => {
    expect(script).toContain('try {');
    expect(script).toContain('} catch {');
  });

  it('sets color-scheme too, so native controls and scrollbars match', () => {
    expect(script).toContain('colorScheme');
  });

  it('is the only colour source: no prefers-color-scheme query survives in the stylesheets', () => {
    // The theme is resolved in JS so the player's choice can override the OS. A colour media
    // query left in CSS would silently win over data-theme.
    expect(cssRules('src/index.css')).not.toMatch(/prefers-color-scheme/);
    expect(cssRules('src/ui/Board.css')).not.toMatch(/prefers-color-scheme/);
  });

  it('still allows prefers-reduced-motion, so the rule above has not over-reached', () => {
    expect(cssRules('src/ui/Board.css')).toContain('prefers-reduced-motion');
  });

  it('defines both tile-1 and tile-2 as variables, not duplicated selectors', () => {
    // The two lightest tiles are the only ones that differ per theme.
    const board = cssRules('src/ui/Board.css');
    expect(board).toContain('--tile-1-bg');
    expect(board).toContain('--tile-2-bg');
  });

  it('declares both theme-colour metas so the browser chrome matches', () => {
    expect(html).toContain('name="theme-color"');
    expect(html).toContain('(prefers-color-scheme: light)');
    expect(html).toContain('(prefers-color-scheme: dark)');
  });
});
