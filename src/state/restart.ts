import type { GameState } from '../engine';

/**
 * Whether "New game" should ask before throwing the current game away.
 *
 * Only a game in progress needs it:
 *
 * - a fresh game (no moves yet) has nothing to lose, so confirming would be pure friction;
 * - a finished game ('won' or 'over') has an explicit New game button on its own overlay, and
 *   asking there as well would mean confirming twice to start the next game.
 *
 * So the question is asked exactly when there is real progress to lose.
 */
export function shouldConfirmRestart(game: GameState): boolean {
  return game.moves > 0 && game.status === 'playing';
}

/** The body copy for the confirmation. Mentions that undo does not survive a restart. */
export function restartWarning(game: GameState): string {
  const moves = game.moves;
  const noun = moves === 1 ? 'move' : 'moves';
  return `You have played ${moves} ${noun} in this game. Starting a new one clears it, and undo cannot bring it back.`;
}
