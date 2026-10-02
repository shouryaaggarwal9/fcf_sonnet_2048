import type { ThemePreference } from '../state/savedData';

/**
 * Resolving and applying the theme. Kept free of React so the inline boot script in
 * index.html and the app itself can agree on the answer, and so it can be unit tested.
 *
 * The user's brief is a switch between dark and light, so those are the two explicit states.
 * `system` is kept as the value for a first visit, where we follow the OS and let the player
 * override from there.
 */

export const THEME_ATTRIBUTE = 'data-theme';

/** The attribute value that actually gets written: never `system`. */
export type ResolvedTheme = 'light' | 'dark';

/** The OS preference, or false when matchMedia is unavailable. */
export function prefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Turns a stored preference into the theme to paint. */
export function resolveTheme(preference: ThemePreference, systemIsDark: boolean): ResolvedTheme {
  if (preference === 'system') return systemIsDark ? 'dark' : 'light';
  return preference;
}

/**
 * The theme a toggle press should switch to: the opposite of what is showing.
 *
 * The current preference is deliberately not a parameter. From `system` this still goes to the
 * opposite of what the OS resolved to, so the first press always visibly changes something
 * rather than appearing to do nothing.
 */
export function nextPreference(resolved: ResolvedTheme): Exclude<ThemePreference, 'system'> {
  return resolved === 'dark' ? 'light' : 'dark';
}

/**
 * Writes the theme onto the root element. `color-scheme` is set too, so native controls,
 * scrollbars, and the on-screen keyboard match instead of staying light.
 */
export function applyTheme(root: HTMLElement, theme: ResolvedTheme): void {
  root.setAttribute(THEME_ATTRIBUTE, theme);
  root.style.colorScheme = theme;
}

/** The label a screen reader should hear for the toggle, describing what the press will do. */
export function toggleLabel(next: Exclude<ThemePreference, 'system'>): string {
  return next === 'dark' ? 'Switch to dark theme' : 'Switch to light theme';
}
