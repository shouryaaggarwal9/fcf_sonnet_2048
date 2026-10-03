import { useEffect, useRef, useState } from 'react';
import type { GameStatus } from '../engine';
import './GameOverlay.css';
import { moveSettleMs } from './motion';
import { useOverlayFocus } from './useOverlayFocus';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

interface GameOverlayProps {
  status: GameStatus;
  score: number;
  onKeepPlaying: () => void;
  onRestart: () => void;
}

/**
 * True once the board has finished moving, so the overlay may take input.
 *
 * The visual wait is CSS: `.overlay` has `animation-delay: var(--settle-ms)`. This only
 * gates interaction, and it reads the same `moveSettleMs` the stylesheet is built from, so
 * the two cannot drift apart. A timer is used rather than an `animationstart` listener
 * because a throttled or skipped animation would otherwise leave the overlay permanently
 * `inert`, which is a soft-lock the player cannot escape.
 *
 * `active` is the gate that re-arms this. Without it the timer would start at mount, which
 * is long before the game ends, and the overlay would be interactive from its first frame.
 */
function useSettled(active: boolean, delayMs: number): boolean {
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!active) {
      setSettled(false);
      return;
    }
    if (delayMs === 0) {
      setSettled(true);
      return;
    }
    setSettled(false);
    const timer = window.setTimeout(() => setSettled(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [active, delayMs]);

  return active && settled;
}

/**
 * Moves focus to the overlay's primary button when it appears, and puts it back afterwards.
 * Shared with the settings and help dialogs, which need the same behaviour.
 */
export function GameOverlay({ status, score, onKeepPlaying, onRestart }: GameOverlayProps) {
  const reducedMotion = usePrefersReducedMotion();
  const delayMs = moveSettleMs(reducedMotion);
  const shown = status !== 'playing';
  const settled = useSettled(shown, delayMs);

  // The primary action is "keep going" on a win, and "new game" otherwise: the thing the
  // player most likely wants next.
  const primaryRef = useRef<HTMLButtonElement>(null);
  useOverlayFocus(settled, primaryRef);

  if (!shown) return null;
  const won = status === 'won';

  return (
    <div
      className="overlay"
      data-kind={status}
      data-settled={settled ? 'true' : 'false'}
      // A dialog, because it is a decision the player has to make, and `aria-modal` because
      // the game is over: there is nothing behind it to interact with.
      role="dialog"
      aria-modal="true"
      aria-labelledby="overlay-title"
      inert={!settled}
    >
      <p className="overlay-title" id="overlay-title">
        {won ? 'You win!' : 'Game over'}
      </p>
      <p className="overlay-score">Score {score.toLocaleString()}</p>
      <div className="overlay-actions">
        {won && (
          <button
            ref={primaryRef}
            type="button"
            className="btn btn-primary"
            onClick={onKeepPlaying}
          >
            Keep going
          </button>
        )}
        <button
          ref={won ? undefined : primaryRef}
          type="button"
          className={won ? 'btn' : 'btn btn-primary'}
          onClick={onRestart}
        >
          New game
        </button>
      </div>
    </div>
  );
}
