import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import type { Direction } from './engine';
import { startPersistence, startStorageSync, useGameStore } from './state/gameStore';
import { restartWarning, shouldConfirmRestart } from './state/restart';
import { bestFor } from './state/savedData';
import { drawOrder } from './state/tileTracker';
import { Announcer } from './ui/Announcer';
import { Board } from './ui/Board';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { Dpad } from './ui/Dpad';
import { GameOverlay } from './ui/GameOverlay';
import { gameInput } from './ui/gameInput';
import { HowToPlay } from './ui/HowToPlay';
import { motionVars } from './ui/motion';
import { ScoreBox } from './ui/ScoreBox';
import { ScorePopups } from './ui/ScorePopups';
import { SettingsDialog } from './ui/SettingsDialog';
import { ThemeToggle } from './ui/ThemeToggle';
import { useKeyboard } from './ui/useKeyboard';
import { useReducedMotion, useSystemReducedMotion } from './ui/useReducedMotion';
import { useSwipe } from './ui/useSwipe';
import { useTheme } from './ui/useTheme';
import { useUndo } from './ui/useUndo';

export default function App() {
  const game = useGameStore((state) => state.game);
  const tracker = useGameStore((state) => state.tracker);
  const lastTurn = useGameStore((state) => state.lastTurn);
  const best = useGameStore((state) => state.best);
  const settings = useGameStore((state) => state.settings);
  const canUndo = useGameStore((state) => state.history.length > 0);
  const boardEpoch = useGameStore((state) => state.boardEpoch);
  const keepPlaying = useGameStore((state) => state.keepPlaying);
  const restart = useGameStore((state) => state.restart);

  // Persisting on move, and staying in step with other tabs. Both are side effects rather
  // than rendering, so they start once here and tear down with the component.
  useEffect(() => startPersistence(), []);
  useEffect(() => startStorageSync(), []);

  const undo = useUndo();
  const theme = useTheme();
  // Started once here: it keeps data-motion in step with the setting and the OS preference.
  const systemReducedMotion = useSystemReducedMotion();
  useReducedMotion();
  const swipe = useSwipe(gameInput.input);
  const tiles = useMemo(() => drawOrder(tracker), [tracker]);
  const bestScore = bestFor(best, game.board.length);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  /**
   * Whether the restart confirmation is showing. A ref as well as state, because the key and
   * pointer handlers read it on every event and a stale closure would let a move through
   * while the dialog is open.
   */
  const [confirming, setConfirming] = useState(false);
  const confirmingRef = useRef(false);
  confirmingRef.current = confirming;

  const handleRestart = useCallback(() => {
    gameInput.reset(); // drop any queued moves from the old game
    restart();
  }, [restart]);

  const requestRestart = useCallback(() => {
    if (shouldConfirmRestart(game)) {
      setConfirming(true);
      return;
    }
    handleRestart();
  }, [game, handleRestart]);

  const closeConfirm = useCallback(() => setConfirming(false), []);

  // While the dialog is open, the page behind it is inert to pointer events, but our input
  // listeners sit on the window and would still fire. Gate them explicitly.
  const moveOrUndo = useCallback((action: () => void) => {
    if (confirmingRef.current) return;
    action();
  }, []);

  useKeyboard({
    onMove: (direction: Direction) => moveOrUndo(() => gameInput.input(direction)),
    onUndo: () => moveOrUndo(undo),
  });

  return (
    // motionVars is set here as well as on the board, so the Score box animations get the
    // same timing constants. The board keeps its own copy to stay self-contained.
    <main className="app" style={motionVars}>
      <header className="app-header">
        <h1 className="app-title">2048</h1>
        <div className="app-header-end">
          <ThemeToggle next={theme.next} onToggle={theme.toggle} />
          <div className="scores">
            <ScoreBox label="Score" value={game.score} live={game.moves > 0}>
              <ScorePopups moves={game.moves} gained={lastTurn?.gained ?? 0} />
            </ScoreBox>
            <ScoreBox label="Best" value={bestScore} live={bestScore > 0} />
            <ScoreBox label="Moves" value={game.moves} live={game.moves > 0} />
          </div>
        </div>
      </header>

      <div className="app-actions">
        <p className="tagline">
          Join the tiles, reach <strong>2048</strong>.
        </p>
        <div className="app-buttons">
          <button
            type="button"
            className="btn btn-icon"
            onClick={undo}
            disabled={!canUndo}
            aria-label={canUndo ? 'Undo last move' : 'Nothing to undo'}
          >
            {/* A curved arrow. Decorative: the label above carries the meaning. */}
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path
                d="M9 14 4 9l5-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M4 9h9a6 6 0 0 1 0 12h-3"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button type="button" className="btn" onClick={requestRestart}>
            New game
          </button>
          <button
            type="button"
            className="btn btn-icon"
            onClick={() => setHelpOpen(true)}
            aria-label="How to play"
          >
            {/* A question mark. Decorative: the label above carries the meaning. */}
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path
                d="M9.2 9a2.9 2.9 0 1 1 3.6 2.8c-.7.3-1.1 1-1.1 1.7v.4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              <circle cx="11.6" cy="17.6" r="1.3" fill="currentColor" />
            </svg>
          </button>
          <button
            type="button"
            className="btn btn-icon"
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
          >
            {/* A cog. Decorative: the label above carries the meaning. */}
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="2.2" />
              <path
                d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2 5.5 5.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>

      <div className="swipe-area" {...swipe}>
        <Board size={game.board.length} tiles={tiles} epoch={boardEpoch}>
          <GameOverlay
            status={game.status}
            score={game.score}
            onKeepPlaying={keepPlaying}
            onRestart={handleRestart}
          />
        </Board>
      </div>

      {settings.dpad && (
        <Dpad onMove={(direction) => moveOrUndo(() => gameInput.input(direction))} />
      )}

      <Announcer />
      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        systemWantsLess={systemReducedMotion}
      />
      <HowToPlay open={helpOpen} onClose={() => setHelpOpen(false)} />
      <ConfirmDialog
        open={confirming}
        message={restartWarning(game)}
        onConfirm={() => {
          setConfirming(false);
          handleRestart();
        }}
        onCancel={closeConfirm}
      />
    </main>
  );
}
