import { describe, expect, it } from 'vitest';
import { nextPreference, resolveTheme, toggleLabel } from './theme';

describe('resolveTheme', () => {
  it('follows the OS when the preference is system', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });

  it('overrides the OS once the player has chosen', () => {
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('light', true)).toBe('light');
  });
});

describe('nextPreference', () => {
  it('switches to the opposite of what is showing', () => {
    expect(nextPreference('dark')).toBe('light');
    expect(nextPreference('light')).toBe('dark');
  });

  it('never returns system, so the toggle always makes an explicit choice', () => {
    // The bug this avoids: a toggle that set 'system' on a light OS would appear to do
    // nothing on the first press, because nothing would change on screen.
    expect(nextPreference('light')).not.toBe('system');
    expect(nextPreference('dark')).not.toBe('system');
  });

  it('round-trips: pressing twice returns to the theme it started on', () => {
    const first = nextPreference('dark');
    expect(nextPreference(first)).toBe('dark');
  });

  it('a first press from system always changes what is on screen', () => {
    // On a light OS the player sees light, so the press must set dark, and vice versa.
    const shownByOs = resolveTheme('system', false);
    expect(nextPreference(shownByOs)).not.toBe(shownByOs);
  });
});

describe('toggleLabel', () => {
  it('names the theme the press will switch to', () => {
    expect(toggleLabel('dark')).toBe('Switch to dark theme');
    expect(toggleLabel('light')).toBe('Switch to light theme');
  });
});
