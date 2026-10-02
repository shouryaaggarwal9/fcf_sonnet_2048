import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

/** The parts of a MediaQueryList event this module uses. A real one satisfies it. */
type MediaChange = { matches: boolean };

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }
  const list = window.matchMedia(QUERY);
  const handler = (_event: MediaChange) => onChange();
  list.addEventListener('change', handler);
  return () => list.removeEventListener('change', handler);
}

function getSnapshot(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(QUERY).matches;
}

/**
 * True when the OS asks for reduced motion, updating live if the setting changes.
 *
 * This is the OS preference alone. Components that need the *effective* setting, meaning the
 * player's in-app override applied to it, should use `useReducedMotion` in useReducedMotion.ts.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
