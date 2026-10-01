import { useCallback } from 'react';
import { useGameStore } from '../state/gameStore';
import { gameInput } from './gameInput';

/**
 * Undo, wired for every source: the button and the keyboard shortcut both come through here.
 *
 * `gameInput.reset()` runs first and is the important part: it drops any queued moves and
 * releases the move lock. Without it, a move queued for the state we are leaving would fire
 * straight after the undo and immediately undo the undo.
 *
 * `state` cannot import `gameInput` (state must not depend on ui), so this is the seam.
 */
export function requestUndo(): void {
  gameInput.reset();
  useGameStore.getState().undo();
}

/** A stable callback for the Undo button. */
export function useUndo(): () => void {
  return useCallback(() => {
    requestUndo();
  }, []);
}
