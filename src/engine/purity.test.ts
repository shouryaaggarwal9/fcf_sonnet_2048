import { describe, expect, it } from 'vitest';

const sources = import.meta.glob<string>(['./*.ts', '!./*.test.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

const forbidden: [description: string, pattern: RegExp][] = [
  ['Math.random()', /Math\.random\s*\(/],
  ['Date.now()', /Date\.now\s*\(/],
  ['new Date()', /new Date\s*\(/],
  ['a React import', /from\s+['"]react/],
  ['document access', /\bdocument\./],
  ['window access', /\bwindow\./],
  ['localStorage', /\blocalStorage\b/],
];

describe('engine purity', () => {
  it('finds all the engine source files', () => {
    expect(Object.keys(sources).length).toBeGreaterThanOrEqual(8);
  });

  it.each(Object.entries(sources))('%s is deterministic and DOM-free', (_file, source) => {
    for (const [description, pattern] of forbidden) {
      expect(pattern.test(source), `uses ${description}`).toBe(false);
    }
  });
});
