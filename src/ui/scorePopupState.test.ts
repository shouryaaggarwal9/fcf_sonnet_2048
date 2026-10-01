import { describe, expect, it } from 'vitest';
import { removePopup, syncPopups } from './scorePopupState';

describe('syncPopups', () => {
  it('shows a popup when a move gains points', () => {
    expect(syncPopups([], 12, 4)).toEqual([{ id: 12, amount: 4 }]);
  });

  it('shows nothing when a move gains nothing', () => {
    expect(syncPopups([], 12, 0)).toEqual([]);
  });

  it('keeps an earlier popup that is still animating, so fast play overlaps instead of flickering', () => {
    const afterFirst = syncPopups([], 1, 4);
    const afterSecond = syncPopups(afterFirst, 2, 8);
    expect(afterSecond).toEqual([
      { id: 1, amount: 4 },
      { id: 2, amount: 8 },
    ]);
  });

  it('never stacks two popups for the same move, however often it is folded in', () => {
    const once = syncPopups([], 7, 16);
    const twice = syncPopups(once, 7, 16);
    expect(twice).toBe(once);
  });

  it('leaves the list alone when a rejected move gains nothing', () => {
    // A rejected move does not change game.moves, so the same id arrives again with 0.
    const list = syncPopups([], 5, 4);
    expect(syncPopups(list, 5, 0)).toBe(list);
  });

  it('drops every popup when the game is replaced and the move count goes backwards', () => {
    // Undo, restore, or a new game: nothing from the old game should float over the new board.
    const mid = syncPopups(syncPopups([], 9, 32), 10, 8);
    expect(syncPopups(mid, 3, 0)).toEqual([]);
  });

  it('reuses the same array when nothing changes, so React can skip the render', () => {
    const list = syncPopups([], 4, 2);
    expect(syncPopups(list, 4, 2)).toBe(list);
  });
});

describe('removePopup', () => {
  it('removes one popup by id and leaves the rest', () => {
    const list = syncPopups(syncPopups([], 1, 4), 2, 8);
    expect(removePopup(list, 1)).toEqual([{ id: 2, amount: 8 }]);
  });

  it('is a no-op that returns the same array for an id that is not there', () => {
    const list = syncPopups([], 1, 4);
    expect(removePopup(list, 99)).toBe(list);
  });

  it('can empty the list', () => {
    expect(removePopup(syncPopups([], 1, 4), 1)).toEqual([]);
  });
});
