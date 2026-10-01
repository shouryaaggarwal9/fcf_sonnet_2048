import { useEffect } from 'react';
import type { Direction } from '../engine';
import { keyToDirection } from './input';

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/** Calls onMove for arrow and WASD key presses. Listens on the window while mounted. */
export function useKeyboard(onMove: (direction: Direction) => void): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isTypingTarget(event.target)) return;

      const direction = keyToDirection(event);
      if (!direction) return;

      event.preventDefault(); // stop arrow keys from scrolling the page
      onMove(direction);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onMove]);
}
