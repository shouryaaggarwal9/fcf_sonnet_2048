import { useCallback, useMemo } from 'react';
import './App.css';
import type { Direction } from './engine';
import { useGameStore } from './state/gameStore';
import { drawOrder } from './state/tileTracker';
import { Board } from './ui/Board';
import { GameOverlay } from './ui/GameOverlay';
import { gameInput } from './ui/gameInput';
import { ScoreBox } from './ui/ScoreBox';
import { useKeyboard } from './ui/useKeyboard';
import { useSwipe } from './ui/useSwipe';

const DIRECTIONS: readonly Direction[] = ['up', 'left', 'down', 'right'];

export default function App() {
  const game = useGameStore((state) => state.game);
  const tracker = useGameStore((state) => state.tracker);
  const keepPlaying = useGameStore((state) => state.keepPlaying);
  const restart = useGameStore((state) => state.restart);

  useKeyboard(gameInput.input);
  const swipe = useSwipe(gameInput.input);

  const tiles = useMemo(() => drawOrder(tracker), [tracker]);

  const handleRestart = useCallback(() => {
    gameInput.reset(); // drop any queued moves from the old game
    restart();
  }, [restart]);

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
        <button type="button" className="btn" onClick={handleRestart}>
          New game
        </button>
      </div>

      <div className="swipe-area" {...swipe}>
        <Board size={game.board.length} tiles={tiles}>
          <GameOverlay
            status={game.status}
            score={game.score}
            onKeepPlaying={keepPlaying}
            onRestart={handleRestart}
          />
        </Board>
      </div>

      <div className="dev-controls">
        {DIRECTIONS.map((direction) => (
          <button
            key={direction}
            type="button"
            className="btn"
            onClick={() => gameInput.input(direction)}
          >
            {direction}
          </button>
        ))}
      </div>
    </main>
  );
}
