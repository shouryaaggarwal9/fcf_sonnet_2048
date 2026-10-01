import { useEffect, useState } from 'react';
import type { GameStatus } from '../engine';
import './GameOverlay.css';
import { moveSettleMs } from './motion';
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

export function GameOverlay({ status, score, onKeepPlaying, onRestart }: GameOverlayProps) {
  const reducedMotion = usePrefersReducedMotion();
  const delayMs = moveSettleMs(reducedMotion);
  const shown = status !== 'playing';
  const settled = useSettled(shown, delayMs);

  if (!shown) return null;
  const won = status === 'won';

  return (
    <div
      className="overlay"
      data-kind={status}
      data-settled={settled ? 'true' : 'false'}
      inert={!settled}
    >
      <p className="overlay-title">{won ? 'You win!' : 'Game over'}</p>
      <p className="overlay-score">Score {score.toLocaleString()}</p>
      <div className="overlay-actions">
        {won && (
          <button type="button" className="btn btn-primary" onClick={onKeepPlaying}>
            Keep going
          </button>
        )}
        <button type="button" className={won ? 'btn' : 'btn btn-primary'} onClick={onRestart}>
          New game
        </button>
      </div>
    </div>
  );
}
