/**
 * What a screen reader is told about a turn.
 *
 * Deliberately quiet. A 2048 board holds dozens of tiles, and announcing every one of them
 * would make the game unusable with a screen reader. Only events a player would want to know
 * about are announced: a merge, reaching the win tile, and the game ending.
 *
 * Pure, so the wording can be tested without a DOM or a store.
 */

/** The notable things about one turn, as the UI can see them. */
export interface TurnFacts {
  /** Values of tiles this move created by merging. Empty when nothing merged. */
  merged: readonly number[];
  /** Score after the move. */
  score: number;
  status: 'playing' | 'won' | 'over';
  keepPlaying: boolean;
}

/**
 * The sentence for one turn, or null when nothing worth saying happened.
 *
 * A move that only slides tiles and spawns a new one says nothing at all: the board already
 * shows it, and a player who is listening does not need "you moved".
 */
export function turnAnnouncement(facts: TurnFacts): string | null {
  if (facts.status === 'over') return `Game over. Final score ${format(facts.score)}.`;
  if (facts.status === 'won' && !facts.keepPlaying) {
    return `You reached 2048. Score ${format(facts.score)}.`;
  }

  if (facts.merged.length === 0) return null;

  // One merge is the common case and reads best on its own: "Merged to 128."
  if (facts.merged.length === 1) {
    return `Merged to ${format(facts.merged[0] ?? 0)}. Score ${format(facts.score)}.`;
  }

  const tiles = facts.merged.map(format).join(' and ');
  return `Merged ${facts.merged.length} tiles to ${tiles}. Score ${format(facts.score)}.`;
}

function format(value: number): string {
  return value.toLocaleString('en-US');
}

/** The instructions a screen reader user gets on first load. */
export const BOARD_INSTRUCTIONS =
  'Join matching tiles to reach 2048. Use the arrow keys or WASD to move, or swipe. Press U to undo.';
