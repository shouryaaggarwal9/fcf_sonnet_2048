import { describe, expect, it } from 'vitest';
import { BOARD_INSTRUCTIONS, turnAnnouncement } from './announcements';

const base = {
  merged: [] as readonly number[],
  score: 0,
  status: 'playing' as const,
  keepPlaying: false,
};

describe('turnAnnouncement', () => {
  it('says nothing for a move that only slid tiles', () => {
    // The board already shows the slide, and "you moved" is noise.
    expect(turnAnnouncement({ ...base, score: 4 })).toBeNull();
  });

  it('announces a single merge with its value and the new score', () => {
    expect(turnAnnouncement({ ...base, merged: [128], score: 1456 })).toBe(
      'Merged to 128. Score 1,456.',
    );
  });

  it('announces several merges in one move', () => {
    expect(turnAnnouncement({ ...base, merged: [64, 128], score: 300 })).toBe(
      'Merged 2 tiles to 64 and 128. Score 300.',
    );
  });

  it('groups large numbers with separators, matching the on-screen score', () => {
    expect(turnAnnouncement({ ...base, merged: [2048], score: 20000 })).toBe(
      'Merged to 2,048. Score 20,000.',
    );
  });

  it('announces reaching 2048', () => {
    expect(turnAnnouncement({ ...base, merged: [2048], score: 20000, status: 'won' })).toBe(
      'You reached 2048. Score 20,000.',
    );
  });

  it('stays quiet about the win once the player has chosen to keep playing', () => {
    // Otherwise continuing past 2048 would announce the win again on every single move.
    expect(
      turnAnnouncement({ ...base, merged: [4096], score: 40000, status: 'won', keepPlaying: true }),
    ).toBe('Merged to 4,096. Score 40,000.');
  });

  it('announces game over with the final score', () => {
    expect(turnAnnouncement({ ...base, score: 12345, status: 'over' })).toBe(
      'Game over. Final score 12,345.',
    );
  });

  it('prefers the ending over the merge, so it is not stated twice', () => {
    const message = turnAnnouncement({ ...base, merged: [512], score: 900, status: 'over' });
    expect(message).toBe('Game over. Final score 900.');
    expect(message).not.toContain('Merged');
  });
});

describe('BOARD_INSTRUCTIONS', () => {
  it('names every way to move the tiles', () => {
    expect(BOARD_INSTRUCTIONS).toContain('arrow keys');
    expect(BOARD_INSTRUCTIONS).toContain('WASD');
    expect(BOARD_INSTRUCTIONS).toContain('swipe');
  });

  it('mentions undo, which is otherwise undiscoverable', () => {
    expect(BOARD_INSTRUCTIONS).toContain('undo');
  });
});
