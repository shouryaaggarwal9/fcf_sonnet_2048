// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { STORAGE_KEY } from './persistence';

/**
 * The crash screen, tested rather than assumed.
 *
 * The whole point of this component is the case nobody can reproduce on demand: something has
 * already gone wrong. So it is tested by throwing on purpose, which also means the fallback path
 * is exercised on every run instead of only ever existing.
 */

afterEach(cleanup);

beforeEach(() => {
  localStorage.clear();
});

/** A child that throws on render, which is the situation the boundary exists for. */
function Explode({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('boom');
  return <p>the game</p>;
}

describe('ErrorBoundary', () => {
  it('renders its children while nothing is wrong', () => {
    render(
      <ErrorBoundary>
        <Explode shouldThrow={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('the game')).toBeTruthy();
  });

  it('shows a recovery screen instead of a blank page when a child throws', () => {
    // React logs the error; silenced so the test output stays readable.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(
        <ErrorBoundary>
          <Explode shouldThrow />
        </ErrorBoundary>,
      );
      const alert = screen.getByRole('alert');
      expect(alert.textContent).toContain('Something went wrong');
      expect(screen.getByRole('button', { name: /clear saved game/i })).toBeTruthy();
    } finally {
      spy.mockRestore();
    }
  });

  it('says the save will be lost, so the button is not a surprise', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(
        <ErrorBoundary>
          <Explode shouldThrow />
        </ErrorBoundary>,
      );
      expect(screen.getByRole('alert').textContent).toMatch(/starting a new one/i);
    } finally {
      spy.mockRestore();
    }
  });

  it('clears the saved game when the button is used', async () => {
    // The save is what most often carries the fault, so clearing it is the actual repair. This
    // is asserted directly rather than inferred from a reload, because jsdom cannot navigate.
    localStorage.setItem(STORAGE_KEY, '{"version":4,"data":{}}');
    const reload = vi.fn();
    const original = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...original, reload },
    });

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const user = userEvent.setup();
      render(
        <ErrorBoundary>
          <Explode shouldThrow />
        </ErrorBoundary>,
      );
      await user.click(screen.getByRole('button', { name: /clear saved game/i }));

      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
      // Reloading rather than resetting state, so nothing from the crashed attempt survives.
      expect(reload).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
      Object.defineProperty(window, 'location', { configurable: true, value: original });
    }
  });
});
