import { useEffect, useRef } from 'react';
import './ConfirmDialog.css';

interface ConfirmDialogProps {
  open: boolean;
  /** Body copy. Should say what is being lost. */
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * The "are you sure?" for throwing away a game in progress.
 *
 * Built on the native <dialog> element rather than a hand-rolled modal, because the platform
 * already does the hard parts correctly: the top layer, the focus trap, inerting the page
 * behind it, Escape to dismiss, and returning focus to whatever opened it. Reimplementing any
 * of that is how modals end up leaking focus.
 *
 * `showModal()` is called imperatively because React's `open` prop would give a plain dialog
 * with no focus trap, no backdrop, and no Escape handling.
 */
export function ConfirmDialog({ open, message, onConfirm, onCancel }: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Fires for Escape as well as an explicit close(), so both routes land on onCancel. Without
  // this, dismissing with Escape would leave our state thinking the dialog is still open.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handleClose = () => onCancel();
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onCancel]);

  return (
    <dialog
      ref={ref}
      className="confirm"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-body"
    >
      <h2 id="confirm-title" className="confirm-title">
        Start a new game?
      </h2>
      <p id="confirm-body" className="confirm-body">
        {message}
      </p>
      <div className="confirm-actions">
        {/*
          No autoFocus prop: showModal() already moves focus to the first focusable element,
          which is this button. That puts focus on the safe choice without asking React to
          focus it, so nothing can strip it and the behaviour is the platform's.
        */}
        <button type="button" className="btn" onClick={onCancel}>
          Keep playing
        </button>
        <button type="button" className="btn btn-primary" onClick={onConfirm}>
          New game
        </button>
      </div>
    </dialog>
  );
}
