import { useCallback, useMemo } from 'react';
import './App.css';
import type { Direction } from './engine';
import { useGameStore } from './state/gameStore';
import { drawOrder } from './state/tileTracker';
import { Board } from './ui/Board';
import { GameOverlay } from './ui/GameOverlay';
import { gameInput } from './ui/gameInput';
import { motionVars } from './ui/motion';
import { ScoreBox } from './ui/ScoreBox';
import { ScorePopups } from './ui/ScorePopups';
import { useKeyboard } from './ui/useKeyboard';
import { useSwipe } from './ui/useSwipe';

const DIRECTIONS: readonly Direction[] = ['up', 'left', 'down', 'right'];

export default function App() {
  const game = useGameStore((state) => state.game);
  const tracker = useGameStore((state) => state.tracker);
  const lastTurn = useGameStore((state) => state.lastTurn);
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
    // motionVars is set here as well as on the board, so the Score box animations get the
    // same timing constants. The board keeps its own copy to stay self-contained.
    <main className="app" style={motionVars}>
      <header className="app-header">
        <h1 className="app-title">2048</h1>
        <div className="scores">
          <ScoreBox label="Score" value={game.score} live={game.moves > 0}>
            <ScorePopups moves={game.moves} gained={lastTurn?.gained ?? 0} />
          </ScoreBox>
          <ScoreBox label="Moves" value={game.moves} live={game.moves > 0} />
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
