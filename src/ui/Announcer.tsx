import { useEffect, useRef, useState } from 'react';
import { turnAnnouncement } from '../state/announcements';
import { useGameStore } from '../state/gameStore';

/**
 * A polite live region that says the things worth hearing.
 *
 * `aria-live="polite"` rather than `assertive`: a merge is feedback, not an alarm, and an
 * assertive region would interrupt whatever the player was already listening to.
 */
export function Announcer() {
  const [message, setMessage] = useState('');

  const moves = useGameStore((state) => state.game.moves);
  const lastTurn = useGameStore((state) => state.lastTurn);
  const score = useGameStore((state) => state.game.score);
  const status = useGameStore((state) => state.game.status);
  const keepPlaying = useGameStore((state) => state.game.keepPlaying);

  /**
   * The move count identifies a turn, so it decides whether there is anything new to say.
   * Page load and a rejected move leave it unchanged and announce nothing.
   */
  const lastSeen = useRef<number | null>(null);

  useEffect(() => {
    if (lastSeen.current === null) {
      lastSeen.current = moves;
      return;
    }
    if (lastSeen.current === moves) return;
    lastSeen.current = moves;

    // Undo also changes the move count, but it clears lastTurn, so an undo announces nothing
    // rather than repeating the merge that was just taken back.
    if (!lastTurn) return;

    const sentence = turnAnnouncement({
      merged: lastTurn.merged,
      score,
      status,
      keepPlaying,
    });
    if (!sentence) return;

    // A live region only speaks when its content changes, so two identical merges in a row
    // would be silent. Clearing first guarantees a change is always observed.
    setMessage('');
    const timer = window.setTimeout(() => setMessage(sentence), 50);
    return () => window.clearTimeout(timer);
  }, [moves, lastTurn, score, status, keepPlaying]);

  return (
    <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
      {message}
    </div>
  );
}
