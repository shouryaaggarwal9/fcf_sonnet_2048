import { useEffect, useState } from 'react';
import {
  applyUpdate,
  canInstall,
  isInstalled,
  needsManualInstall,
  promptInstall,
  setUpdateListener,
  subscribePwa,
} from '../pwa';
import './UpdateToast.css';

/**
 * The update prompt, shown as an unobtrusive strip.
 *
 * The roadmap is explicit that a new version must never be applied mid-game, so nothing here
 * reloads on its own: the player is told and chooses. The board is in localStorage, so even if
 * they accept, the game survives the reload.
 */
export function UpdateToast() {
  const [updateReady, setUpdateReady] = useState(false);
  const [, forceRender] = useState(0);

  useEffect(() => {
    setUpdateListener(() => setUpdateReady(true));
    const unsubscribe = subscribePwa(() => forceRender((n) => n + 1));
    return () => {
      setUpdateListener(null);
      unsubscribe();
    };
  }, []);

  if (!updateReady) return null;

  return (
    <div className="update-toast" role="status">
      <span className="update-text">A new version is ready.</span>
      <button type="button" className="btn btn-sm" onClick={applyUpdate}>
        Reload
      </button>
    </div>
  );
}

/**
 * The install section for the settings dialog.
 *
 * Three cases, because the browsers genuinely differ: Chromium offers a real prompt, iOS never
 * does and needs instructions instead, and an installed app needs nothing at all.
 */
export function InstallRow() {
  const [, forceRender] = useState(0);
  useEffect(() => subscribePwa(() => forceRender((n) => n + 1)), []);

  const installed = isInstalled();
  const manual = needsManualInstall();

  if (installed) {
    return <p className="settings-hint">2048 is installed. You can play offline.</p>;
  }

  if (manual) {
    return (
      <p className="settings-hint">
        To install on iPhone: tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.
        It will work offline once opened.
      </p>
    );
  }

  return (
    <button
      type="button"
      className="btn"
      disabled={!canInstall()}
      onClick={() => void promptInstall()}
    >
      {canInstall() ? 'Install 2048' : 'Install unavailable in this browser'}
    </button>
  );
}
