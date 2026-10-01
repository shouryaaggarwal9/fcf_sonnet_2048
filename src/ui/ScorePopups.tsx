import { useEffect, useState } from 'react';
import { SCORE_GAIN_MS } from './motion';
import { removePopup, type ScorePopup, syncPopups } from './scorePopupState';

/** Slack before the timeout backstop fires, so animationend is normally what cleans up. */
const CLEANUP_SLACK_MS = 400;

interface ScorePopupsProps {
  /** The move count. This is the popup's identity, and also how a replaced game is detected. */
  moves: number;
  /** Points gained by that move. Zero means no popup. */
  gained: number;
}

/**
 * The floating "+N" markers above the Score box.
 *
 * Kept in local state rather than the store: this is pure presentation, and it must survive
 * re-renders of the same move without stacking duplicates.
 */
export function ScorePopups({ moves, gained }: ScorePopupsProps) {
  const [popups, setPopups] = useState<readonly ScorePopup[]>([]);

  // Fold each move into the popup list in an effect, not during render: mutating a ref
  // during render breaks under StrictMode double-render and can swallow an update.
  // Queued moves are spaced by the move lock, so each move gets its own render + effect.
  useEffect(() => {
    setPopups((current) => syncPopups(current, moves, gained));
  }, [moves, gained]);

  useEffect(() => {
    if (popups.length === 0) return;
    // animationend should always fire, but a backgrounded tab does not run animations, so
    // without this a popup could stay in the DOM forever.
    const timers = popups.map((popup) =>
      window.setTimeout(() => {
        setPopups((current) => removePopup(current, popup.id));
      }, SCORE_GAIN_MS + CLEANUP_SLACK_MS),
    );
    return () => {
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [popups]);

  return (
    <>
      {popups.map((popup) => (
        <span
          key={popup.id}
          className="score-popup"
          aria-hidden="true"
          onAnimationEnd={() => setPopups((current) => removePopup(current, popup.id))}
        >
          +{popup.amount}
        </span>
      ))}
    </>
  );
}
