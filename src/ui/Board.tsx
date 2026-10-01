import type { CSSProperties, ReactNode } from 'react';
import type { DrawnTile } from '../state/tileTracker';
import { Tile } from './Tile';
import './Board.css';
import { motionVars } from './motion';

interface BoardProps {
  size: number;
  tiles: readonly DrawnTile[];
  children?: ReactNode;
}

export function Board({ size, tiles, children }: BoardProps) {
  const cellIds = Array.from({ length: size * size }, (_, index) => `cell-${index}`);

  return (
    <div className="board" style={{ '--size': size, ...motionVars } as CSSProperties}>
      <div className="board-inner">
        <div className="board-grid" aria-hidden="true">
          {cellIds.map((id) => (
            <div key={id} className="board-cell" />
          ))}
        </div>
        <div className="board-tiles">
          {tiles.map((tile) => (
            <Tile key={tile.id} {...tile} />
          ))}
        </div>
      </div>
      {children}
    </div>
  );
}
