import type { Direction } from '../engine';

/** The parts of a KeyboardEvent we look at. A real KeyboardEvent satisfies this. */
export interface KeyInfo {
  code: string;
  repeat: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  isComposing: boolean;
}

/** Physical key codes, so WASD stays in the same place on every keyboard layout. */
const KEY_MAP = new Map<string, Direction>([
  ['ArrowUp', 'up'],
  ['ArrowDown', 'down'],
  ['ArrowLeft', 'left'],
  ['ArrowRight', 'right'],
  ['KeyW', 'up'],
  ['KeyS', 'down'],
  ['KeyA', 'left'],
  ['KeyD', 'right'],
]);

/** Returns the direction a key press means, or null if it should be ignored. */
export function keyToDirection(event: KeyInfo): Direction | null {
  if (event.repeat || event.isComposing) return null;
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  return KEY_MAP.get(event.code) ?? null;
}

/** How far a finger must travel, in CSS pixels, before it counts as a swipe. */
export const MIN_SWIPE_PX = 24;

/**
 * True if a key press means "undo". `U` on its own, or `Ctrl+Z` / `Cmd+Z`.
 *
 * Kept apart from `keyToDirection` on purpose: the direction map is a closed set, and undo
 * is not a direction. Both follow the same rules, though, so undo cannot fire on key repeat,
 * during IME composition, or while Alt is held.
 */
export function isUndoKey(event: KeyInfo): boolean {
  if (event.repeat || event.isComposing || event.altKey) return false;
  if (event.code === 'KeyU') return !event.ctrlKey && !event.metaKey;
  if (event.code === 'KeyZ') return event.ctrlKey !== event.metaKey; // exactly one, not both
  return false;
}

/**
 * Turns a drag vector into a direction, or null if it is too short or exactly diagonal.
 * The longer axis wins. Screen coordinates: +x is right, +y is down.
 */
export function swipeToDirection(
  dx: number,
  dy: number,
  minDistance = MIN_SWIPE_PX,
): Direction | null {
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);

  if (Math.max(absX, absY) < minDistance) return null;
  if (absX === absY) return null;

  if (absX > absY) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}
