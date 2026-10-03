/**
 * Fails if the production bundle grows past its budget.
 *
 * The roadmap sets a target of under 100 kB gzip for the shipped game. This runs in CI on every
 * pull request, so a dependency that quietly adds weight fails the build rather than being
 * noticed months later in a slow web vitals report.
 *
 * The budget counts what a player actually downloads: the JavaScript and CSS entry chunks. It
 * deliberately excludes the service worker and the Workbox runtime, which are fetched once by
 * the installer and are not on the critical path for a first visit.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

/** Ceilings for the shipped entry assets. Slightly under the roadmap's 100 kB suggestion. */
const BUDGET_KB = {
  js: 100,
  css: 12,
  total: 112,
};

const dist = join(process.cwd(), 'dist');
const assets = join(dist, 'assets');

/** Workbox runtime and the worker itself: fetched by the installer, not on first load. */
function isInstallerOnly(name) {
  return name.startsWith('workbox-') || name === 'sw.js';
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function gzipKb(file) {
  return gzipSync(readFileSync(file)).length / 1024;
}

const files = walk(assets).filter((file) => !isInstallerOnly(file.split(/[\\/]/).pop()));

let js = 0;
let css = 0;
const rows = [];

for (const file of files) {
  const kb = gzipKb(file);
  rows.push({ file: file.replace(`${dist}\\`, '').replace('/', '/'), kb });
  if (file.endsWith('.js')) js += kb;
  if (file.endsWith('.css')) css += kb;
}

const total = js + css;
rows.sort((a, b) => b.kb - a.kb);

process.stdout.write('Bundle (gzipped)\n');
for (const row of rows) {
  process.stdout.write(`  ${row.kb.toFixed(1).padStart(7)} kB  ${row.file}\n`);
}
process.stdout.write(
  `\n  js ${js.toFixed(1)} / ${BUDGET_KB.js} kB, css ${css.toFixed(1)} / ${BUDGET_KB.css} kB, ` +
    `total ${total.toFixed(1)} / ${BUDGET_KB.total} kB\n`,
);

const failures = [
  ['js', js, BUDGET_KB.js],
  ['css', css, BUDGET_KB.css],
  ['total', total, BUDGET_KB.total],
].filter(([, value, budget]) => value > budget);

if (failures.length > 0) {
  process.stderr.write('\nOver budget:\n');
  for (const [name, value, budget] of failures) {
    process.stderr.write(`  ${name}: ${value.toFixed(1)} kB exceeds ${budget} kB\n`);
  }
  process.exitCode = 1;
} else {
  process.stdout.write('Within budget.\n');
}
