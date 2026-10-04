/**
 * Computes the CSP hashes for the inline scripts in the built index.html.
 *
 * The theme and motion boot script in index.html has to be inline, or the page paints in the
 * wrong theme and then snaps. A strict CSP forbids inline scripts, so the only way to keep it is
 * to allow exactly that script by hash. Which means the hash has to be right, and a hash that
 * silently drifts is a page whose theme never applies and whose console fills with CSP errors.
 *
 * It reads `dist/index.html` rather than the source on purpose: Vite rewrites the HTML it emits,
 * so a hash computed from the source can differ from the bytes actually served by a character or
 * two of whitespace, which is enough to break it.
 *
 * Usage:
 *   node scripts/csp-hash.mjs           print the hashes
 *   node scripts/csp-hash.mjs --write   print them and update vercel.json
 *
 * `src/state/security.test.ts` fails if vercel.json and the built HTML disagree, so the two
 * cannot drift without CI noticing.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = join(process.cwd(), 'dist');
const indexPath = join(dist, 'index.html');

/**
 * The inline scripts in the document, in source order.
 *
 * Deliberately narrow: a `<script>` with a `src` is not inline and needs no hash. The type
 * attribute is not checked either, since a `type` the browser does not execute is not a script
 * the CSP has to permit.
 */
export function inlineScripts(html) {
  const out = [];
  const pattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(pattern)) {
    const attributes = match[1] ?? '';
    if (/\bsrc\s*=/i.test(attributes)) continue;
    out.push(match[2] ?? '');
  }
  return out;
}

/** A CSP hash source for one script's exact text. */
export function hashSource(source) {
  const digest = createHash('sha256').update(source, 'utf8').digest('base64');
  return `'sha256-${digest}'`;
}

function readDist() {
  try {
    return readFileSync(indexPath, 'utf8');
  } catch {
    throw new Error(`No ${indexPath}. Run \`pnpm build\` before this script.`);
  }
}

const html = readDist();
const hashes = inlineScripts(html).map(hashSource);

if (hashes.length === 0) {
  process.stderr.write('No inline scripts found in dist/index.html, so no hashes are needed.\n');
}

for (const hash of hashes) process.stdout.write(`${hash}\n`);

if (process.argv.includes('--write')) {
  const configPath = join(process.cwd(), 'vercel.json');
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  const headers = config.headers ?? [];
  let found = 0;
  let changed = 0;

  for (const entry of headers) {
    if (!entry.headers) continue;
    for (const header of entry.headers) {
      if (header.key !== 'Content-Security-Policy') continue;
      if (!header.value.includes('script-src')) continue;
      found += 1;
      // Keep every directive except script-src, then rebuild that one from the real hashes.
      const directives = header.value
        .split(';')
        .map((directive) => directive.trim())
        .filter((directive) => directive !== '' && !directive.startsWith('script-src'));
      directives.unshift(`script-src 'self' ${hashes.join(' ')}`);
      const next = directives.join('; ');
      if (next !== header.value) changed += 1;
      header.value = next;
    }
  }

  if (found === 0) {
    process.stderr.write('vercel.json has no script-src directive to update.\n');
    process.exitCode = 1;
  } else if (changed === 0) {
    // Already in sync. Exiting non-zero here would make `pnpm csp` fail every time it is run
    // for no reason, which is how a repair command gets ignored.
    process.stdout.write('vercel.json already matches dist/index.html. Nothing to do.\n');
  } else {
    writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
    process.stdout.write(`Updated script-src in ${changed} header(s) in vercel.json.\n`);
  }
}
