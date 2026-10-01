/**
 * The "+N" that rises and fades from the Score box.
 *
 * This is pure state logic so it can be tested without a DOM. The component that renders
 * it, `ScorePopups.tsx`, does nothing else.
 */
export interface ScorePopup {
  /** The `game.moves` count when this popup was created. Also its React key, so popups
   * from two different moves are separate elements with independent animations. */
  id: number;
  /** Points gained. Never zero: a move that gained nothing has no popup. */
  amount: number;
}

/**
 * Folds one move's result into the list of popups on screen.
 *
 * The list only ever holds popups whose animation is still running, and `id` is the move
 * count, so:
 *
 * - a move that gained nothing adds nothing, and a rejected move changes neither argument,
 *   so it adds nothing either;
 * - the same `id` never appears twice, however many times it arrives, so repeated renders
 *   and animation re-entry cannot stack duplicates;
 * - an `id` behind the newest popup means the game itself was replaced (new game, undo,
 *   restore), so every popup from the old game is dropped rather than left floating over a
 *   board that no longer belongs to it;
 * - popups still animating when the next move arrives are kept, so a fast player sees
 *   overlapping "+N" instead of a flicker.
 */
export function syncPopups(
  popups: readonly ScorePopup[],
  id: number,
  amount: number,
): readonly ScorePopup[] {
  const newest = popups[popups.length - 1];
  const kept = newest !== undefined && id < newest.id ? [] : popups;
  if (amount <= 0 || kept.some((popup) => popup.id === id)) return kept;
  return [...kept, { id, amount }];
}

/** Drops a popup whose animation has finished, so its element leaves the DOM. */
export function removePopup(popups: readonly ScorePopup[], id: number): readonly ScorePopup[] {
  const next = popups.filter((popup) => popup.id !== id);
  return next.length === popups.length ? popups : next;
}
