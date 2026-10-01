import type { ReactNode } from 'react';
import './ScoreBox.css';

interface ScoreBoxProps {
  label: string;
  value: number;
  /** Layered over the box, positioned by the stylesheet. Used for the floating "+N". */
  children?: ReactNode;
}

export function ScoreBox({ label, value, children }: ScoreBoxProps) {
  return (
    <div className="score-box">
      <span className="score-label">{label}</span>
      {/* Keyed on the value so a change remounts the element and restarts the bump. */}
      <span className="score-value" key={value}>
        {value.toLocaleString()}
      </span>
      {children}
    </div>
  );
}
