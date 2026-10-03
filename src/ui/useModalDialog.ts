import { useEffect, useRef } from 'react';

/**
 * Drives a native <dialog> and keeps focus where it belongs.
 *
 * Why this is separate from `useOverlayFocus`, which does the same job for the game-over
 * overlay: that one is a `div` with `role="dialog"`, which has no `showModal()` to call and no
 * `close` event to listen to. Here the browser's own show/hide steps move focus as a side
 * effect, and getting the order wrong loses it entirely:
 *
 * - The opener has to be captured *before* `showModal()`, because showModal moves focus into
 *   the dialog. Captured afterwards it stores the close button, so closing returns focus to a
 *   button inside a dialog that is no longer open, and the player lands on nothing.
 * - Focus has to be restored *after* the dialog is actually closed, not merely after our state
 *   says so. Restoring earlier gets bounced back into the dialog by the browser and then lost
 *   when it closes. The `close` event is the only reliable signal for that moment.
 *
 * Getting this wrong is invisible in Chromium, whose native <dialog> restores focus by itself.
 * It is a real defect in Safari, where dismissing a dialog dropped keyboard players at the top
 * of the document.
 */
export function useModalDialog(
  open: boolean,
  onClose: () => void,
  initialFocus: React.RefObject<HTMLElement | null>,
): React.RefObject<HTMLDialogElement | null> {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    // Fires for Escape as well as close(), so both routes update our state.
    const handleClose = () => {
      const previous = opener.current;
      opener.current = null;
      onClose();
      // After onClose, because React may have already unmounted or re-rendered; the dialog is
      // definitely closed at this point, so the browser will not steal the focus back.
      if (previous?.isConnected) previous.focus();
    };

    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onClose]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      // Captured first, deliberately. showModal() is what moves focus.
      opener.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
      initialFocus.current?.focus();
      return;
    }
    if (!open && dialog.open) dialog.close();
  }, [open, initialFocus]);

  return ref;
}
