import { useCallback, useEffect } from 'react';
import { useGameStore } from '../state/gameStore';
import { applyTheme, nextPreference, prefersDark, resolveTheme, THEME_ATTRIBUTE } from './theme';

/**
 * Keeps <html data-theme> in step with the saved preference.
 *
 * The inline script in index.html has already set the attribute before first paint, so this
 * only has to (a) react when the player toggles, and (b) follow the OS while the preference
 * is still `system`. It never writes a stale value, because it always reads the store.
 */
export function useTheme(): {
  /** The theme actually on screen. */
  resolved: 'light' | 'dark';
  /** Pressing the toggle switches to this. */
  next: 'light' | 'dark';
  toggle: () => void;
} {
  const preference = useGameStore((state) => state.settings.theme);
  const setTheme = useGameStore((state) => state.setTheme);

  const resolved = resolveTheme(preference, prefersDark());
  const next = nextPreference(resolved);

  useEffect(() => {
    applyTheme(document.documentElement, resolved);
  }, [resolved]);

  // While the preference is `system`, follow the OS live, and stop once the player chooses.
  useEffect(() => {
    if (preference !== 'system') return;
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const list = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () =>
      applyTheme(document.documentElement, resolveTheme('system', list.matches));
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [preference]);

  const toggle = useCallback(() => {
    setTheme(next);
  }, [next, setTheme]);

  return { resolved, next, toggle };
}

/** Re-exported so callers do not import from two modules for one concept. */
export { THEME_ATTRIBUTE };
