import './ScoreBox.css';

interface ScoreBoxProps {
  label: string;
  value: number;
}

export function ScoreBox({ label, value }: ScoreBoxProps) {
  return (
    <div className="score-box">
      <span className="score-label">{label}</span>
      <span className="score-value">{value.toLocaleString()}</span>
    </div>
  );
}
