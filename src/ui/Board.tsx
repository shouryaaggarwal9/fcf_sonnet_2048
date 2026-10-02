import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { BOARD_INSTRUCTIONS } from '../state/announcements';
import type { DrawnTile } from '../state/tileTracker';
import { Tile } from './Tile';
import './Board.css';
import { motionVars } from './motion';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

interface BoardProps {
  size: number;
  tiles: readonly DrawnTile[];
  /**
   * Bumped when the board is replaced wholesale (undo, another tab). The previous board is
   * held on screen for a moment and dissolved off the top of the new one.
   */
  epoch?: number;
  children?: ReactNode;
}

/**
 * Renders a board, and cross-dissolves it when it is replaced rather than moved.
 *
 * The replacement is not animated by fading the new board in. Doing that made the whole board
 * appear out of nothing, which read as a pop. Instead the new board is simply correct from
 * the first frame, and the board it replaced sits on top of it and fades away, so the change
 * reads as one dissolving into the other.
 */
export function Board({ size, tiles, epoch = 0, children }: BoardProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [outgoing, setOutgoing] = useState<readonly DrawnTile[] | null>(null);

  // The board currently on screen, captured before a replacement overwrites it. A ref is
  // right here: this is bookkeeping between renders, not state anyone reads.
  const onScreen = useRef(tiles);
  const seenEpoch = useRef(epoch);

  if (epoch !== seenEpoch.current) {
    seenEpoch.current = epoch;
    // Reduced motion swaps instantly, so there is nothing to dissolve.
    setOutgoing(reducedMotion ? null : onScreen.current);
  }
  onScreen.current = tiles;

  // Belt and braces: animationend should always fire, but a backgrounded tab does not run
  // animations, and without this the old board would sit over the new one forever.
  useEffect(() => {
    if (!outgoing) return;
    const timer = window.setTimeout(() => setOutgoing(null), RESTORE_CLEANUP_MS);
    return () => window.clearTimeout(timer);
  }, [outgoing]);

  const cellIds = Array.from({ length: size * size }, (_, index) => `cell-${index}`);
  const drawn = outgoing === null ? tiles : outgoing;

  return (
    // role="img" with a label, because the board is a picture of numbers: a screen reader
    // cannot usefully walk sixteen absolutely positioned tiles, and announcing each one would
    // drown out everything that matters. The live region in App announces the changes instead.
    <div
      className="board"
      role="img"
      aria-label={`Game board, ${size} by ${size}. ${BOARD_INSTRUCTIONS}`}
      style={{ '--size': size, ...motionVars } as CSSProperties}
    >
      <div className="board-inner">
        <div className="board-grid" aria-hidden="true">
          {cellIds.map((id) => (
            <div key={id} className="board-cell" />
          ))}
        </div>

        {/*
          The live board. Keyed on the epoch so a replacement never reuses a DOM node from the
          board it replaced: a reused node would slide from a stale position.
        */}
        <div className="board-tiles" key={epoch}>
          {tiles.map((tile) => (
            <Tile key={tile.id} {...tile} />
          ))}
        </div>

        {/*
          The board being replaced, sitting on top and fading out. aria-hidden because these
          tiles are no longer the state of the game, and pointer-events are off in CSS so a
          dissolving tile can never intercept a swipe.
        */}
        {outgoing !== null && (
          <div
            className="board-tiles board-tiles-outgoing"
            aria-hidden="true"
            onAnimationEnd={() => setOutgoing(null)}
          >
            {drawn.map((tile) => (
              <Tile key={tile.id} {...tile} />
            ))}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

/** Longer than the dissolve, so the timeout only fires if the animation never ran. */
const RESTORE_CLEANUP_MS = 400;
