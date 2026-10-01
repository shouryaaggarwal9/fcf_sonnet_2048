import type { CSSProperties } from 'react';
import type { DrawnTile } from '../state/tileTracker';
import { tileTier } from './tiles';

/**
 * The outer element slides (transform transition). The inner one draws the tile and carries
 * the spawn, pop, and ghost animations, so a scale never competes with a slide.
 */
export function Tile({ value, row, col, birth, ghost }: DrawnTile) {
  return (
    <div
      className="tile"
      data-tier={tileTier(value)}
      data-digits={String(value).length}
      data-birth={birth}
      data-ghost={ghost}
      aria-hidden={ghost || undefined}
      style={{ '--row': row, '--col': col } as CSSProperties}
    >
      <div className="tile-inner">
        <span className="tile-value">{value}</span>
      </div>
    </div>
  );
}
