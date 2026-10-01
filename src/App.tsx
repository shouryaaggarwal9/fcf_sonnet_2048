import { useMemo } from 'react';
import './App.css';
import type { Direction } from './engine';
import { useGameStore } from './state/gameStore';
import { Board } from './ui/Board';
import { GameOverlay } from './ui/GameOverlay';
import { ScoreBox } from './ui/ScoreBox';
import { boardToTiles } from './ui/tiles';
import { useKeyboard } from './ui/useKeyboard';

const DIRECTIONS: readonly Direction[] = ['up', 'left', 'down', 'right'];

export default function App() {
  const game = useGameStore((state) => state.game);
  const move = useGameStore((state) => state.move);
  const keepPlaying = useGameStore((state) => state.keepPlaying);
  const restart = useGameStore((state) => state.restart);

  useKeyboard(move);

  const tiles = useMemo(() => boardToTiles(game.board), [game.board]);

  return (
    <main className="app">
      <header className="app-header">
        <h1 className="app-title">2048</h1>
        <div className="scores">
          <ScoreBox label="Score" value={game.score} />
          <ScoreBox label="Moves" value={game.moves} />
        </div>
      </header>

      <div className="app-actions">
        <p className="tagline">
          Join the tiles, reach <strong>2048</strong>.
        </p>
        <button type="button" className="btn" onClick={() => restart()}>
          New game
        </button>
      </div>

      <Board size={game.board.length} tiles={tiles}>
        <GameOverlay
          status={game.status}
          score={game.score}
          onKeepPlaying={keepPlaying}
          onRestart={() => restart()}
        />
      </Board>

      <div className="dev-controls">
        {DIRECTIONS.map((direction) => (
          <button key={direction} type="button" className="btn" onClick={() => move(direction)}>
            {direction}
          </button>
        ))}
      </div>
    </main>
  );
}
