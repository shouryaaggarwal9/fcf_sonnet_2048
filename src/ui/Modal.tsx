import { useEffect, useRef } from 'react';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * The shell both dialogs use, on the native <dialog> element.
 *
 * One implementation means the focus trap, the Escape handling, the backdrop, and the focus
 * restoration are done once and cannot drift between the two. React's `open` prop would give a
 * plain dialog with none of that, so showModal() is called imperatively.
 */
export function Modal({ open, title, onClose, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = `modal-${title.replace(/\s+/g, '-').toLowerCase()}`;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    // Fires for Escape as well as close(), so both routes update our state.
    const handleClose = () => onClose();
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onClose]);

  return (
    <dialog ref={ref} className="modal" aria-labelledby={titleId} onCancel={onClose}>
      <div className="modal-head">
        <h2 className="modal-title" id={titleId}>
          {title}
        </h2>
        <button type="button" className="btn btn-icon" onClick={onClose} aria-label="Close">
          {/* Decorative: the aria-label above carries the meaning. */}
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
              d="M6 6l12 12M18 6 6 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
