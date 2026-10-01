import { useMemo } from 'react';
import type { Direction } from './engine';
import { useGameStore } from './state/gameStore';
import { Board } from './ui/Board';
import { boardToTiles } from './ui/tiles';

const DIRECTIONS: readonly Direction[] = ['up', 'left', 'down', 'right'];

export default function App() {
  const game = useGameStore((state) => state.game);
  const move = useGameStore((state) => state.move);
  const keepPlaying = useGameStore((state) => state.keepPlaying);
  const restart = useGameStore((state) => state.restart);

  const tiles = useMemo(() => boardToTiles(game.board), [game.board]);

  return (
    <main>
      <h1>2048</h1>
      <p>
        Score {game.score} · Moves {game.moves} · {game.status}
      </p>
      <Board size={game.board.length} tiles={tiles} />
      <div>
        {DIRECTIONS.map((direction) => (
          <button key={direction} type="button" onClick={() => move(direction)}>
            {direction}
          </button>
        ))}
      </div>
      <div>
        {game.status === 'won' && (
          <button type="button" onClick={keepPlaying}>
            keep playing
          </button>
        )}
        <button type="button" onClick={() => restart()}>
          new game
        </button>
      </div>
    </main>
  );
}
