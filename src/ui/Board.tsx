import type { CSSProperties, ReactNode } from 'react';
import type { DrawnTile } from '../state/tileTracker';
import { Tile } from './Tile';
import './Board.css';
import { motionVars } from './motion';

interface BoardProps {
  size: number;
  tiles: readonly DrawnTile[];
  /**
   * Bumped when the board is replaced wholesale (undo, another tab). The tile layer is keyed
   * on it so the tiles are rebuilt rather than moved, and the crossfade covers the change.
   * Only changes on replacement, so ordinary slides are untouched.
   */
  epoch?: number;
  children?: ReactNode;
}

export function Board({ size, tiles, epoch = 0, children }: BoardProps) {
  const cellIds = Array.from({ length: size * size }, (_, index) => `cell-${index}`);

  return (
    <div className="board" style={{ '--size': size, ...motionVars } as CSSProperties}>
      <div className="board-inner">
        <div className="board-grid" aria-hidden="true">
          {cellIds.map((id) => (
            <div key={id} className="board-cell" />
          ))}
        </div>
        {/*
          Keyed on the epoch: replacing the board remounts this layer, so no tile can slide
          from a stale position. Epoch 0 is the first render, which must not fade.
        */}
        <div className="board-tiles" key={epoch} data-fade={epoch > 0 ? 'true' : 'false'}>
          {tiles.map((tile) => (
            <Tile key={tile.id} {...tile} />
          ))}
        </div>
      </div>
      {children}
    </div>
  );
}
