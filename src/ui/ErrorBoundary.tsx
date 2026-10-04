import { Component, type ErrorInfo, type ReactNode } from 'react';
import { STORAGE_KEY, safeStorage } from '../state/persistence';
import './ErrorBoundary.css';

/**
 * The last line of defence: a crash in the app shows a way out instead of a blank page.
 *
 * Worth having for a game whose whole state lives in one localStorage key. A truncated write, a
 * quota failure mid-save, or a future migration that gets a shape wrong would otherwise leave
 * the player staring at an empty screen with no way to recover and no way to know why. Here they
 * get a button that clears the save and starts fresh, which turns an unrecoverable-looking bug
 * into losing one game.
 *
 * Deliberately not reporting anywhere. Errors are shown to the player and printed to the
 * console, and nothing leaves the device. That is a product decision, and adding a reporting
 * service is the owner's call, not this file's.
 */

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  failed: boolean;
}

/**
 * Removes the saved game, so a reload starts clean.
 *
 * Kept here rather than passed in because the only thing that needs it is the recovery button
 * below, and a boundary that takes a reset callback invites it to be wired to the wrong thing.
 */
function clearSave(): void {
  // safeStorage rather than localStorage directly: storage throws in private mode, and a
  // recovery path must not be the thing that throws.
  safeStorage()?.removeItem(STORAGE_KEY);
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Console rather than a reporting service. See the note at the top of the file.
    console.error('2048 crashed', error, info.componentStack);
  }

  private readonly reset = () => {
    clearSave();
    // Reload rather than setState: the state that crashed may still be in memory, and a fresh
    // document is the only way to be certain the next attempt starts from nothing.
    window.location.reload();
  };

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;

    return (
      <div className="crash">
        <div className="crash-card" role="alert">
          <h1 className="crash-title">Something went wrong</h1>
          <p className="crash-text">
            The game ran into a problem and could not keep going. Clearing the saved game usually
            fixes it, though it means starting a new one.
          </p>
          <button type="button" className="btn btn-primary" onClick={this.reset}>
            Clear saved game and restart
          </button>
          <p className="crash-text crash-detail">
            The details are in the browser console, if you want to report them.
          </p>
        </div>
      </div>
    );
  }
}
