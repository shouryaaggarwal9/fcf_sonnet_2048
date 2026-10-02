// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newGame } from '../engine';
import { Announcer } from '../ui/Announcer';
import { GameOverlay } from '../ui/GameOverlay';
import { useGameStore } from './gameStore';

/**
 * Component tests for the UI logic that unit tests cannot reach: focus, roles, and what a
 * screen reader is actually told.
 *
 * jsdom is opted into per file, so the rest of the suite stays in the faster node environment.
 * Plain assertions are used rather than jest-dom matchers, to avoid a dependency for `textContent`
 * and `getAttribute`, which are already readable.
 */

afterEach(cleanup);

beforeEach(() => {
  useGameStore.setState({
    game: newGame(1),
    tracker: { tiles: [], ghosts: [], nextId: 1 },
    lastTurn: null,
    best: {},
    settings: { theme: 'system', dpad: false, motion: 'system' },
    history: [],
    undos: 0,
    boardEpoch: 0,
  });
});

const liveRegion = () => screen.getByRole('status');
const text = (node: HTMLElement) => node.textContent ?? '';

describe('Announcer', () => {
  it('says nothing on load, before any move', () => {
    render(<Announcer />);
    expect(text(liveRegion())).toBe('');
  });

  it('announces a merge with the new value and score', async () => {
    render(<Announcer />);
    useGameStore.setState({
      game: { ...newGame(1), score: 4, moves: 1 },
      lastTurn: { gained: 4, spawned: null, merged: [4] },
    });

    await screen.findByText('Merged to 4. Score 4.');
  });

  it('is polite rather than assertive, so it never interrupts', () => {
    render(<Announcer />);
    expect(liveRegion().getAttribute('aria-live')).toBe('polite');
  });

  it('says nothing for a move that only slid tiles', async () => {
    render(<Announcer />);
    useGameStore.setState({
      game: { ...newGame(1), moves: 1 },
      lastTurn: { gained: 0, spawned: { row: 1, col: 1, value: 2 }, merged: [] },
    });

    // Give any effect that was going to fire a chance to.
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(text(liveRegion())).toBe('');
  });

  it('announces nothing new when a move is undone, rather than repeating the merge', async () => {
    render(<Announcer />);

    useGameStore.setState({
      game: { ...newGame(1), score: 8, moves: 1 },
      lastTurn: { gained: 8, spawned: null, merged: [8] },
    });
    await screen.findByText('Merged to 8. Score 8.');
    const afterMerge = text(liveRegion());

    // An undo drops the move count and clears lastTurn.
    useGameStore.setState({ game: { ...newGame(1), moves: 0 }, lastTurn: null });
    await new Promise((resolve) => setTimeout(resolve, 150));

    // The region keeps what it last said, which is correct: a live region announces on a
    // change of content, so retaining it announces nothing. What matters is that the undo
    // did not produce a second sentence.
    expect(text(liveRegion())).toBe(afterMerge);
  });

  it('announces game over with the final score', async () => {
    render(<Announcer />);
    useGameStore.setState({
      game: { ...newGame(1), score: 1200, moves: 9, status: 'over' },
      lastTurn: { gained: 0, spawned: null, merged: [] },
    });

    await screen.findByText('Game over. Final score 1,200.');
  });
});

describe('GameOverlay', () => {
  const noop = () => {};

  it('renders nothing while the game is playing', () => {
    const { container } = render(
      <GameOverlay status="playing" score={0} onKeepPlaying={noop} onRestart={noop} />,
    );
    expect(container.querySelector('.overlay')).toBeNull();
  });

  it('is a modal dialog when the game is over', () => {
    render(<GameOverlay status="over" score={1200} onKeepPlaying={noop} onRestart={noop} />);
    const overlay = screen.getByRole('dialog');
    expect(overlay.getAttribute('aria-modal')).toBe('true');
    expect(text(overlay)).toContain('Game over');
    expect(text(overlay)).toContain('Score 1,200');
  });

  it('names itself through its title, so it is announced properly', () => {
    render(<GameOverlay status="over" score={0} onKeepPlaying={noop} onRestart={noop} />);
    // An unlabelled dialog is a common screen reader failure.
    const labelledBy = screen.getByRole('dialog').getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    expect(text(document.getElementById(labelledBy ?? '') as HTMLElement)).toBe('Game over');
  });

  it('offers Keep going on a win, and not on a loss', () => {
    const { rerender } = render(
      <GameOverlay status="won" score={10} onKeepPlaying={noop} onRestart={noop} />,
    );
    expect(screen.getByRole('button', { name: 'Keep going' })).toBeTruthy();

    rerender(<GameOverlay status="over" score={10} onKeepPlaying={noop} onRestart={noop} />);
    expect(screen.queryByRole('button', { name: 'Keep going' })).toBeNull();
  });

  it('calls the right handler for each action', async () => {
    const user = userEvent.setup();
    let kept = 0;
    let restarted = 0;
    const { rerender } = render(
      <GameOverlay
        status="won"
        score={10}
        onKeepPlaying={() => kept++}
        onRestart={() => restarted++}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Keep going' }));
    expect(kept).toBe(1);

    rerender(
      <GameOverlay
        status="over"
        score={10}
        onKeepPlaying={() => kept++}
        onRestart={() => restarted++}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'New game' }));
    expect(restarted).toBe(1);
  });

  it('takes focus when it appears, which was the known focus bug', async () => {
    const opener = document.createElement('button');
    opener.textContent = 'New game';
    document.body.append(opener);
    opener.focus();
    expect(document.activeElement).toBe(opener);

    render(<GameOverlay status="over" score={0} onKeepPlaying={noop} onRestart={noop} />);
    const overlay = await screen.findByRole('dialog');

    await vi.waitFor(() => {
      expect(overlay.contains(document.activeElement)).toBe(true);
    });
    // Specifically the primary action, so Enter does the expected thing.
    expect(document.activeElement?.textContent?.trim()).toBe('New game');

    opener.remove();
  });
});

describe('the overlay is reachable by keyboard', () => {
  it('exposes its actions as ordinary buttons', () => {
    render(<GameOverlay status="over" score={10} onKeepPlaying={() => {}} onRestart={() => {}} />);
    const overlay = screen.getByRole('dialog');
    const buttons = within(overlay).getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      expect(button.tagName).toBe('BUTTON');
    }
  });
});
