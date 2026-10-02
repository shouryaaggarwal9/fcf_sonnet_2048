import { describe, expect, it } from 'vitest';
import { newGame } from '../engine';
import { restartWarning, shouldConfirmRestart } from './restart';

const playing = (moves: number) => ({ ...newGame(1), moves, status: 'playing' as const });

describe('shouldConfirmRestart', () => {
  it('asks when a game is in progress', () => {
    expect(shouldConfirmRestart(playing(1))).toBe(true);
    expect(shouldConfirmRestart(playing(50))).toBe(true);
  });

  it('does not ask on a fresh game, because there is nothing to lose', () => {
    expect(shouldConfirmRestart(playing(0))).toBe(false);
    expect(shouldConfirmRestart(newGame(1))).toBe(false);
  });

  it('does not ask once the game is won, which has its own button on the overlay', () => {
    expect(shouldConfirmRestart({ ...playing(30), status: 'won' })).toBe(false);
  });

  it('does not ask once the game is over', () => {
    expect(shouldConfirmRestart({ ...playing(30), status: 'over' })).toBe(false);
  });
});

describe('restartWarning', () => {
  it('says how much is being lost', () => {
    expect(restartWarning(playing(12))).toContain('12 moves');
  });

  it('uses the singular for exactly one move', () => {
    expect(restartWarning(playing(1))).toContain('1 move');
  });

  it('always mentions that undo cannot bring the game back', () => {
    for (const moves of [1, 2, 100]) {
      expect(restartWarning(playing(moves))).toContain('undo');
    }
  });
});
