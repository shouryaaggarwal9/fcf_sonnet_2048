import { useEffect } from 'react';
import { useGameStore } from '../state/gameStore';
import { prefersReducedMotion } from './motionPreference';

/**
 * The OS media query, as a subscription.
 *
 * This reads only the OS preference. Components that need the *effective* setting, meaning the
 * player's override applied to it, should use `useReducedMotion` instead.
 */
const QUERY = '(prefers-reduced-motion: reduce)';

function systemWantsLess(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(QUERY).matches;
}

/**
 * Keeps `data-motion` on <html> in step with the player's preference and the OS setting.
 *
 * The stylesheets read that attribute rather than the media query, because a media query
 * cannot see an in-app preference: honouring an override would otherwise have meant
 * duplicating every reduced-motion rule under a second selector.
 *
 * Started once from App. Returns the resolved setting so a caller can use it directly.
 */
export function useReducedMotion(): boolean {
  const choice = useGameStore((state) => state.settings.motion);

  useEffect(() => {
    const apply = () => {
      const reduced = prefersReducedMotion(choice, systemWantsLess());
      document.documentElement.dataset.motion = reduced ? 'reduce' : 'full';
    };

    apply();

    // Only worth listening while following the system; an explicit choice cannot change.
    if (choice !== 'system' || typeof window === 'undefined' || !window.matchMedia) {
      return;
    }
    const list = window.matchMedia(QUERY);
    list.addEventListener('change', apply);
    return () => list.removeEventListener('change', apply);
  }, [choice]);

  return prefersReducedMotion(choice, systemWantsLess());
}

/** True when the OS itself asks for reduced motion, for showing as context in settings. */
export function useSystemReducedMotion(): boolean {
  return systemWantsLess();
}
