import type { CSSProperties } from 'react';
import { Tile } from './Tile';
import type { TileView } from './tiles';
import './Board.css';

interface BoardProps {
  size: number;
  tiles: readonly TileView[];
}

export function Board({ size, tiles }: BoardProps) {
  const cellIds = Array.from({ length: size * size }, (_, index) => `cell-${index}`);

  return (
    <div className="board" style={{ '--size': size } as CSSProperties}>
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
    </div>
  );
}
