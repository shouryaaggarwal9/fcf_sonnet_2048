import type { GameStatus } from '../engine';
import './GameOverlay.css';

interface GameOverlayProps {
  status: GameStatus;
  score: number;
  onKeepPlaying: () => void;
  onRestart: () => void;
}

export function GameOverlay({ status, score, onKeepPlaying, onRestart }: GameOverlayProps) {
  if (status === 'playing') return null;
  const won = status === 'won';

  return (
    <div className="overlay" data-kind={status}>
      <p className="overlay-title">{won ? 'You win!' : 'Game over'}</p>
      <p className="overlay-score">Score {score.toLocaleString()}</p>
      <div className="overlay-actions">
        {won && (
          <button type="button" className="btn btn-primary" onClick={onKeepPlaying}>
            Keep going
          </button>
        )}
        <button type="button" className={won ? 'btn' : 'btn btn-primary'} onClick={onRestart}>
          New game
        </button>
      </div>
    </div>
  );
}
