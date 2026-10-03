import { useEffect, useRef } from 'react';

/**
 * Focus handling shared by every dialog in the app.
 *
 * Two jobs, and the second is the one that is easy to miss:
 *
 * 1. Move focus into the dialog when it opens. Otherwise it appears without being announced to
 *    a screen reader and tabbing carries on through the page behind it.
 * 2. Put focus back on whatever opened it. Chromium's native <dialog> does this on its own,
 *    which is exactly why the bug survived until the tests ran on WebKit: WebKit drops focus to
 *    the document, so dismissing a dialog in Safari threw a keyboard player at the top of the
 *    page. Doing it here means both engines behave the same way.
 *
 * `primaryRef` may be null, for a dialog that is happy with whatever the browser focuses first.
 *
 * Focus is only taken once the dialog has settled, so nothing is focused while it is still
 * invisible behind the game-over delay.
 */
export function useOverlayFocus(
  active: boolean,
  primaryRef: React.RefObject<HTMLElement | null> | null,
): void {
  const restoreTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) {
      // Restoring on the way out is what keeps the player where they were.
      const previous = restoreTo.current;
      restoreTo.current = null;
      if (previous?.isConnected) previous.focus();
      return;
    }
    restoreTo.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }, [active]);

  useEffect(() => {
    if (active) primaryRef?.current?.focus();
  }, [active, primaryRef]);
}
