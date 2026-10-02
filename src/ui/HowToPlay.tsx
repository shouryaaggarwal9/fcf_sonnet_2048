import { Modal } from './Modal';
import './Modal.css';

interface HowToPlayProps {
  open: boolean;
  onClose: () => void;
}

const RULES = [
  'Every tile shows a power of two. The board starts with two 2s.',
  'Swipe or press an arrow key to slide every tile as far as it will go.',
  'Two tiles of the same number that touch merge into one of double the value.',
  'A new tile appears after every move, so the board keeps filling up.',
  'There are no moves left when no tile can slide and no two neighbours match. That is game over.',
  'Your best score is kept per board size and never goes down.',
];

const SHORTCUTS: readonly [keys: string, action: string][] = [
  ['Arrow keys or W A S D', 'Move tiles'],
  ['U', 'Undo the last move'],
  ['Ctrl+Z or Cmd+Z', 'Undo the last move'],
  ['Escape', 'Close a dialog'],
];

/** Rules and keyboard shortcuts. The only place either is written down. */
export function HowToPlay({ open, onClose }: HowToPlayProps) {
  return (
    <Modal open={open} title="How to play" onClose={onClose}>
      <ol className="rules">
        {RULES.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ol>

      <h3 className="modal-subtitle">Keyboard</h3>
      <dl className="shortcuts">
        {SHORTCUTS.map(([keys, action]) => (
          <div key={keys} className="shortcut">
            <dt>
              <kbd>{keys}</kbd>
            </dt>
            <dd>{action}</dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}
