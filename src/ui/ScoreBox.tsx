import type { ReactNode } from 'react';
import './ScoreBox.css';

interface ScoreBoxProps {
  label: string;
  value: number;
  /**
   * True once the game has started. The number bump is suppressed before the first move,
   * so page load shows no animation.
   */
  live: boolean;
  /** Layered over the box, positioned by the stylesheet. Used for the floating "+N". */
  children?: ReactNode;
}

export function ScoreBox({ label, value, live, children }: ScoreBoxProps) {
  return (
    <div className="score-box">
      <span className="score-label">{label}</span>
      {/* Keyed on the value so a change remounts the element and restarts the bump.
          Before the first move the static key keeps the element animation-free. */}
      <span
        key={live ? `v-${value}` : 'initial'}
        className={live ? 'score-value' : 'score-value score-value-static'}
      >
        {value.toLocaleString()}
      </span>
      {children}
    </div>
  );
}
