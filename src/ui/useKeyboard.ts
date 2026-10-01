import { useEffect } from 'react';
import type { Direction } from '../engine';
import { isUndoKey, keyToDirection } from './input';

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

interface KeyboardOptions {
  onMove: (direction: Direction) => void;
  onUndo: () => void;
}

/**
 * Calls onMove for arrow and WASD key presses, and onUndo for `U` or `Ctrl/Cmd+Z`.
 * Listens on the window while mounted. Either callback may be omitted.
 */
export function useKeyboard({ onMove, onUndo }: Partial<KeyboardOptions>): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isTypingTarget(event.target)) return;

      // Undo is checked first: Ctrl+Z must not be read as a direction, and it must work
      // even when the game is over, where moves are rejected.
      if (onUndo && isUndoKey(event)) {
        event.preventDefault(); // stop the browser's own text undo
        onUndo();
        return;
      }

      const direction = keyToDirection(event);
      if (!direction || !onMove) return;

      event.preventDefault(); // stop arrow keys from scrolling the page
      onMove(direction);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onMove, onUndo]);
}
