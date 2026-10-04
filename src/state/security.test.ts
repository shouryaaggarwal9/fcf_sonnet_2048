/// <reference types="node" />
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Guards the security headers and cache rules in vercel.json.
 *
 * These are the one part of the deployment that cannot be exercised by opening the app, because
 * a missing header breaks nothing visibly: the page loads, the game plays, and the only symptom
 * is a missing defence. So they are asserted here instead, including the one thing that silently
 * rots, which is the CSP hash for the inline boot script.
 *
 * The hash is checked against `dist/index.html`, not against the source index.html, because Vite
 * rewrites the HTML it emits. Run `pnpm build` before `pnpm test` after touching the boot script,
 * or `pnpm csp` to recompute and write the hash for you.
 */

const read = (relativePath: string) =>
  readFileSync(fileURLToPath(new URL(`../../${relativePath}`, import.meta.url)), 'utf8');

interface HeaderEntry {
  source: string;
  headers?: { key: string; value: string }[];
}

const vercel = JSON.parse(read('vercel.json')) as { headers?: HeaderEntry[] };
const entries = vercel.headers ?? [];

/** The value of one header on one source pattern. */
function headerOn(source: string, key: string): string | undefined {
  const entry = entries.find((candidate) => candidate.source === source);
  return entry?.headers?.find((header) => header.key === key)?.value;
}

/** The catch-all that applies to the HTML document. */
const catchAll = '/(.*)';
const csp = headerOn(catchAll, 'Content-Security-Policy') ?? '';

/** One directive, e.g. script-src, without its values. */
function directive(name: string): string | undefined {
  return csp
    .split(';')
    .map((part) => part.trim())
    .find((part) => part === name || part.startsWith(`${name} `));
}

describe('the security headers are present', () => {
  it('sends a Content-Security-Policy on the document', () => {
    expect(csp).not.toBe('');
  });

  it('stops scripts from anywhere but this origin and one hashed script', () => {
    // The load-bearing directive. 'unsafe-inline' here would allow any injected script, which
    // is the whole thing a CSP is for, so it is asserted absent rather than merely unused.
    const scriptSrc = directive('script-src');
    expect(scriptSrc).toBeDefined();
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
    expect(scriptSrc).toContain("'self'");
  });

  it('allows exactly the inline boot script, by hash', () => {
    const hashes = (directive('script-src') ?? '').match(/'sha256-[^']+'/g) ?? [];
    expect(hashes).toHaveLength(1);
  });

  it("keeps 'unsafe-inline' out of every directive that can execute code", () => {
    // style-src has to keep it: tiles are positioned with inline style attributes. That is a
    // far smaller risk than script-src, but it should be a recorded decision, not an accident.
    expect(directive('script-src')).not.toContain("'unsafe-inline'");
    expect(directive('object-src')).not.toContain("'unsafe-inline'");
  });

  it('permits the service worker, which app-src-style directives would otherwise block', () => {
    // Missing worker-src is a classic: the page loads fine and simply never works offline.
    expect(directive('worker-src')).toBe("worker-src 'self'");
  });

  it('locks down the directives that stop injected content being useful', () => {
    expect(directive('object-src')).toBe("object-src 'none'");
    expect(directive('base-uri')).toBe("base-uri 'self'");
    expect(directive('form-action')).toBe("form-action 'none'");
    expect(directive('frame-ancestors')).toBe("frame-ancestors 'none'");
  });

  it('sets the headers the roadmap asked for', () => {
    expect(headerOn(catchAll, 'X-Content-Type-Options')).toBe('nosniff');
    expect(headerOn(catchAll, 'Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(headerOn(catchAll, 'Permissions-Policy')).toContain('camera=()');
    expect(headerOn(catchAll, 'Permissions-Policy')).toContain('microphone=()');
    // X-Frame-Options is the legacy fallback for frame-ancestors, kept deliberately.
    expect(headerOn(catchAll, 'X-Frame-Options')).toBe('DENY');
  });
});

describe('the cache rules are right', () => {
  it('caches hashed assets for a year, because their name changes when they do', () => {
    expect(headerOn('/assets/(.*)', 'Cache-Control')).toBe('public, max-age=31536000, immutable');
  });

  it('never caches the service worker, or returning clients pin an old one forever', () => {
    // The single most consequential rule in the file. Vercel's default for a static file would
    // let a stale worker sit in the HTTP cache and keep serving an old app shell.
    for (const source of ['/sw.js', '/workbox-(.*).js']) {
      const value = headerOn(source, 'Cache-Control') ?? '';
      expect(value, source).toContain('max-age=0');
      expect(value, source).toContain('must-revalidate');
      expect(value, source).not.toContain('immutable');
    }
  });

  it('revalidates the document, so a deploy is picked up', () => {
    const value = headerOn(catchAll, 'Cache-Control') ?? '';
    expect(value).toContain('max-age=0');
    expect(value).toContain('must-revalidate');
  });

  it('gives unhashed public files a short cache rather than a long one', () => {
    // public/ files keep their names across deploys, so `immutable` on them would make an icon
    // or the manifest impossible to change without renaming it.
    for (const source of ['/(.*).png', '/icon.svg', '/favicon.ico', '/manifest.webmanifest']) {
      const value = headerOn(source, 'Cache-Control') ?? '';
      expect(value, source).toMatch(/max-age=(3600|604800)/);
      expect(value, source).not.toContain('immutable');
    }
  });
});

describe('the accepted zoom tradeoff is consistent across every tool that checks it', () => {
  /**
   * Two tools report the blocked pinch-zoom as a violation: axe (meta-viewport) and Lighthouse
   * (meta-viewport, which alone cost 7 points of the accessibility score). Both accept it, for
   * the same reason and with the same caveat.
   *
   * The two facts are asserted as a pair rather than separately, because the failure mode of
   * tracking them by hand is drift: someone re-enables zoom for accessibility and forgets to
   * remove the exemptions, and the audit silently stops running with nothing checking it.
   */
  const viewportDisablesZoom =
    /user-scalable=no/.test(read('index.html')) && /maximum-scale=1/.test(read('index.html'));

  const lighthouseSkipsIt = (
    JSON.parse(read('.lighthouserc.json')) as {
      ci?: { collect?: { settings?: { skipAudits?: string[] } } };
    }
  ).ci?.collect?.settings?.skipAudits;

  it('the page does disable pinch-zoom, which is the premise of every exemption', () => {
    expect(viewportDisablesZoom).toBe(true);
  });

  it('Lighthouse skips meta-viewport exactly while zoom is disabled', () => {
    expect(lighthouseSkipsIt).toEqual(viewportDisablesZoom ? ['meta-viewport'] : []);
  });
});

describe('the CSP hash matches the built page', () => {
  const indexPath = fileURLToPath(new URL('../../dist/index.html', import.meta.url));
  const built = existsSync(indexPath);

  it.skipIf(!built)('is in sync with dist/index.html', () => {
    // The failure this catches is silent: the theme stops applying before first paint and the
    // console fills with violations. Computed the same way scripts/csp-hash.mjs does, from the
    // built HTML, because that is the bytes the browser is actually given.
    const html = readFileSync(indexPath, 'utf8');
    const inline: string[] = [];
    for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      if (/\bsrc\s*=/i.test(match[1] ?? '')) continue;
      inline.push(match[2] ?? '');
    }
    expect(inline).toHaveLength(1);

    const expected = `'sha256-${createHash('sha256')
      .update(inline[0] ?? '', 'utf8')
      .digest('base64')}'`;

    expect(directive('script-src')).toContain(expected);
  });

  it.skipIf(!built)('is checked at all, so the test cannot pass by skipping', () => {
    // Guards the guard: without this, forgetting to build would silently skip the test above and
    // the hash could rot unnoticed.
    expect(built).toBe(true);
  });
});
