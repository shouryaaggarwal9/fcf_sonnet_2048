import { toggleLabel } from './theme';

interface ThemeToggleProps {
  /** The theme a press will switch to. Decides both the icon and the label. */
  next: 'light' | 'dark';
  onToggle: () => void;
}

/**
 * The dark/light switch.
 *
 * One button rather than a three-way control: the owner's brief is a switch between the two
 * themes that already worked, so that is what this is. A first visit still follows the OS,
 * and the choice is remembered from then on.
 *
 * The accessible name states the action ("Switch to dark theme"), not the current state, so a
 * screen reader user knows what pressing it will do. The icon is decorative and hidden.
 */
export function ThemeToggle({ next, onToggle }: ThemeToggleProps) {
  const goingDark = next === 'dark';

  return (
    <button
      type="button"
      className="btn btn-icon theme-toggle"
      onClick={onToggle}
      aria-label={toggleLabel(next)}
      title={toggleLabel(next)}
    >
      {goingDark ? (
        // A moon: the theme being switched to.
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        // A sun with rays.
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" strokeWidth="2" />
          <path
            d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  );
}
