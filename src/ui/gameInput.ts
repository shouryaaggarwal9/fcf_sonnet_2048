import { useGameStore } from '../state/gameStore';
import { SLIDE_MS } from './motion';
import { createMoveController } from './moveController';

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Every input source (keyboard, swipe, buttons) goes through this one controller. */
export const gameInput = createMoveController({
  attempt: (direction) => useGameStore.getState().move(direction),
  // Reduced motion has no slide to wait for, so nothing is locked or queued.
  lockMs: () => (prefersReducedMotion() ? 0 : SLIDE_MS),
});
