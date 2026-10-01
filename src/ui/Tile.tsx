import type { CSSProperties } from 'react';
import { type TileView, tileTier } from './tiles';

export function Tile({ value, row, col }: TileView) {
  return (
    <div
      className="tile"
      data-tier={tileTier(value)}
      data-digits={String(value).length}
      style={{ '--row': row, '--col': col } as CSSProperties}
    >
      <span className="tile-value">{value}</span>
    </div>
  );
}
