/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * WCAG 2.1 contrast, asserted against the stylesheets as they actually ship.
 *
 * The original 2048 palette fails AA on ten of twelve tile tiers and on several UI surfaces,
 * because it paints near-white numbers on bright orange and yellow. That was invisible to
 * every other check in this repo, so the ratios are measured here instead of eyeballed. A
 * future palette tweak that regresses a tier fails the build instead of shipping.
 *
 * node:fs is used because Vite's CSS plugin returns an empty string for a `?raw` CSS import.
 * The reference directive is scoped to this file; adding node types to the app tsconfig would
 * let browser code reach for Node APIs.
 */
function read(repoRelativePath: string): string {
  return readFileSync(new URL(`../../${repoRelativePath}`, import.meta.url), 'utf8');
}

const AA_NORMAL = 4.5;
const AA_LARGE = 3;

/** WCAG relative luminance. */
function luminance(hex: string): number {
  const s = hex.trim().replace('#', '');
  const full = s.length === 3 ? [...s].map((c) => c + c).join('') : s;
  const linear = (offset: number): number => {
    const c = Number.parseInt(full.slice(offset, offset + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(0) + 0.7152 * linear(2) + 0.0722 * linear(4);
}

function contrast(a: string, b: string): number {
  const hi = Math.max(luminance(a), luminance(b));
  const lo = Math.min(luminance(a), luminance(b));
  return (hi + 0.05) / (lo + 0.05);
}

/** Reads `--name: #hex;` out of a block of CSS, so the test follows the shipped values. */
function variable(css: string, name: string): string {
  const match = css.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{3,6})`));
  if (!match?.[1]) throw new Error(`variable not found: ${name}`);
  return match[1];
}

/**
 * The `:root[data-theme="dark"]` block, or the `:root` block when none is found.
 *
 * Scoping matters: `--tile-1-bg` is declared once for light and overridden for dark, so a
 * whole-file search would always return the light value and quietly test the wrong pair.
 */
function darkBlock(css: string): string {
  const start = css.indexOf(':root[data-theme="dark"]');
  if (start === -1) return '';
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return css.slice(open, close);
}

/** Reads the `--tile-bg` of one tier rule out of Board.css. */
function tierBackground(css: string, tier: number): string {
  const block = css.match(new RegExp(`\\.tile\\[data-tier="${tier}"\\]\\s*\\{([^}]*)\\}`));
  if (!block?.[1]) throw new Error(`tier not found: ${tier}`);
  const bg = block[1].match(/--tile-bg:\s*(#[0-9a-fA-F]{3,6})/);
  if (bg?.[1]) return bg[1];
  // Tiers 1 and 2 reference the per-theme variable instead of a literal.
  const ref = block[1].match(/--tile-bg:\s*var\((--tile-\d-bg)\)/);
  if (!ref?.[1]) throw new Error(`tier ${tier} has no background`);
  return variable(css, ref[1]);
}

const boardCss = read('src/ui/Board.css');
const indexCss = read('src/index.css');

/** The light theme's variables, i.e. the :root block. */
const rootVars = indexCss.slice(0, indexCss.indexOf(':root[data-theme="dark"]'));
const darkVars = indexCss.slice(indexCss.indexOf(':root[data-theme="dark"]'));

/** Tile ink: dark on the bright tiles, light on the single dark one. */
const BRIGHT_TILE_INK = variable(boardCss, '--tile-ink');
const DARK_TILE_INK = variable(boardCss, '--tile-ink-inverse');

/** The light-theme `:root` block of Board.css, i.e. everything before the dark override. */
const rootBoardBlock = boardCss.slice(0, boardCss.indexOf(':root[data-theme="dark"]'));

describe('tile numbers pass WCAG AA', () => {
  // Tile numbers render at 20cqw to 50cqw, which is far above the 24px large-text threshold,
  // so 3:1 is the applicable bar. 4.5:1 is asserted anyway because every tier clears it.
  for (let tier = 1; tier <= 12; tier++) {
    it(`tier ${tier} (${2 ** (tier - 1)})`, () => {
      const bg = tierBackground(boardCss, tier);
      const ink = tier === 12 ? DARK_TILE_INK : BRIGHT_TILE_INK;
      const ratio = contrast(bg, ink);
      expect(ratio, `${bg} with ${ink}`).toBeGreaterThanOrEqual(AA_NORMAL);
    });
  }

  it('keeps every bright tile above AA even on the worst of them', () => {
    const worst = Math.min(
      ...Array.from({ length: 11 }, (_, i) =>
        contrast(tierBackground(boardCss, i + 1), BRIGHT_TILE_INK),
      ),
    );
    expect(worst).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it('gives every tier a resolvable ink, not merely a declared one', () => {
    // This is a bug the arithmetic above cannot catch. A tier that sets --tile-bg but leaves
    // --tile-fg unset makes `color: var(--tile-fg)` invalid at computed-value time, so the
    // tile silently inherits the body colour. That shipped once: tiers 3 to 11 rendered
    // #6b6152 at 1.9:1 while this file was green, because the ink variable existed and every
    // ratio computed correctly on paper.
    //
    // So the contract is pinned structurally: .tile declares a default, and the tiers that
    // need a different ink say so.
    const tileRule = boardCss.match(/\.tile\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(tileRule, '.tile must declare a default --tile-fg').toContain('--tile-fg');

    // The tiers that invert must actually override it.
    for (const tier of [1, 2, 12]) {
      const block =
        boardCss.match(new RegExp(`\\.tile\\[data-tier="${tier}"\\]\\s*\\{([^}]*)\\}`))?.[1] ?? '';
      expect(block, `tier ${tier} must override --tile-fg`).toContain('--tile-fg');
    }
  });

  it('passes in the dark theme too, where tiers 1 and 2 darken and their ink flips', () => {
    const dark = darkBlock(boardCss);
    expect(dark, 'dark theme block not found').not.toBe('');
    for (const tier of [1, 2]) {
      const bg = variable(dark, `--tile-${tier}-bg`);
      const ink = variable(dark, `--tile-${tier}-ink`);
      expect(contrast(bg, ink), `dark theme tier ${tier}`).toBeGreaterThanOrEqual(AA_NORMAL);
    }
  });

  it('actually darkens tiers 1 and 2 for the dark theme, rather than leaving them light', () => {
    // Guards the scoping above: if the dark block were missed, this would compare light on
    // light and still look like a pass at a glance.
    const dark = darkBlock(boardCss);
    for (const tier of [1, 2]) {
      expect(luminance(variable(dark, `--tile-${tier}-bg`))).toBeLessThan(
        luminance(variable(rootBoardBlock, `--tile-${tier}-bg`)),
      );
    }
  });
});

describe('UI text passes WCAG AA in both themes', () => {
  const pairs: [name: string, fg: string, bg: string, large: boolean][] = [
    ['body text on page', '--text', '--page-bg', false],
    ['score box value on panel', '--panel-fg', '--panel-bg', true],
    ['score box label on panel', '--panel-fg-dim', '--panel-bg', false],
    ['button text', '--btn-fg', '--btn-bg', true],
    ['primary button text', '--btn-primary-fg', '--btn-primary-bg', true],
  ];

  for (const theme of ['light', 'dark'] as const) {
    const css = theme === 'light' ? rootVars : darkVars;

    for (const [name, fg, bg, large] of pairs) {
      it(`${theme}: ${name}`, () => {
        const ratio = contrast(variable(css, fg), variable(css, bg));
        expect(ratio, `${variable(css, fg)} on ${variable(css, bg)}`).toBeGreaterThanOrEqual(
          large ? AA_LARGE : AA_NORMAL,
        );
      });
    }
  }

  it('light: the score label clears AA for small text, not just large', () => {
    // The label is 0.7rem uppercase, so 4.5:1 applies. It previously used opacity 0.8 on the
    // main ink, which blended toward the panel and quietly dropped it below the bar.
    expect(
      contrast(variable(rootVars, '--panel-fg-dim'), variable(rootVars, '--panel-bg')),
    ).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it('defines a distinct ink for the primary button, since one colour cannot serve both', () => {
    // The signature orange needs dark text and the dark theme's red needs light text, so a
    // single shared --btn-fg could never pass in both.
    expect(rootVars).toContain('--btn-primary-fg');
    expect(darkVars).toContain('--btn-primary-fg');
  });
});

describe('the palette still looks like 2048', () => {
  it('keeps the authentic tile backgrounds from gabrielecirulli/2048', () => {
    // The fix was to change the ink, not the colours. If a background drifts, the game stops
    // looking like the game everyone knows.
    const authentic: Record<number, string> = {
      1: '#eee4da',
      2: '#ede0c8',
      3: '#f2b179',
      4: '#f59563',
      5: '#f67c5f',
      6: '#f65e3b',
      7: '#edcf72',
      8: '#edcc61',
      9: '#edc850',
      10: '#edc53f',
      11: '#edc22e',
      12: '#3c3a32',
    };
    for (const [tier, colour] of Object.entries(authentic)) {
      expect(tierBackground(boardCss, Number(tier)), `tier ${tier}`).toBe(colour);
    }
  });

  it('keeps the tiers visually distinct from one another', () => {
    const backgrounds = Array.from({ length: 12 }, (_, i) => tierBackground(boardCss, i + 1));
    expect(new Set(backgrounds).size).toBe(12);
  });
});
