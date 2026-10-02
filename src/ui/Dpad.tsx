import type { Direction } from '../engine';
import './Dpad.css';

interface DpadProps {
  /** Plays a move through the shared controller, so it obeys the lock and the queue. */
  onMove: (direction: Direction) => void;
}

const BUTTONS: readonly { direction: Direction; label: string; glyph: string }[] = [
  { direction: 'up', label: 'Move up', glyph: '▲' },
  { direction: 'left', label: 'Move left', glyph: '◀' },
  { direction: 'right', label: 'Move right', glyph: '▶' },
  { direction: 'down', label: 'Move down', glyph: '▼' },
];

/**
 * The on-screen direction pad: a single-pointer alternative to swiping.
 *
 * WCAG 2.5.1 asks for anything done with a path-based gesture to be doable with a single
 * pointer, and a swipe is exactly that. This is hidden by default, since swiping and the
 * keyboard already cover input and most players never need it.
 *
 * It deliberately reuses gameInput rather than calling the store directly, so a tap is subject
 * to the same move lock and queue as a key press. That also means mashing the pad behaves
 * identically to mashing the arrow keys.
 */
export function Dpad({ onMove }: DpadProps) {
  return (
    // A fieldset with a hidden legend, not role="group": the four buttons are one control, and
    // this is the element that means that. The legend is what names the group for a screen
    // reader, and it is hidden visually rather than removed from the tree.
    <fieldset className="dpad">
      <legend className="visually-hidden">Move tiles</legend>
      {BUTTONS.map((button) => (
        <button
          key={button.direction}
          type="button"
          className={`btn dpad-btn dpad-${button.direction}`}
          // A long label for assistive tech; the glyph is decorative and hidden from it.
          aria-label={button.label}
          onClick={() => onMove(button.direction)}
        >
          <span aria-hidden="true">{button.glyph}</span>
        </button>
      ))}
    </fieldset>
  );
}
