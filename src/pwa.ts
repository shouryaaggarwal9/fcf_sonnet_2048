import { registerSW } from 'virtual:pwa-register';

/**
 * Service worker registration and the install prompt.
 *
 * Registration is done here rather than injected, because both the update flow and the install
 * flow need callbacks, and because a module makes the behaviour testable and readable.
 */

/** Called when a new version is waiting. The app must not reload on its own. */
let onUpdateReady: (() => void) | null = null;

/** The install prompt, if the browser offered one. Null on iOS and when already installed. */
let installPrompt: (Event & { prompt: () => Promise<void> }) | null = null;
let installListeners: (() => void)[] = [];

export interface PwaState {
  /** True when a new version has been downloaded and is waiting to be applied. */
  updateReady: boolean;
  /** True when the browser offered an install prompt that has not been used. */
  canInstall: boolean;
  /** True when the app is already running as an installed app. */
  installed: boolean;
}

/** Subscribes to PWA state changes. Returns an unsubscribe function. */
export function subscribePwa(listener: () => void): () => void {
  installListeners.push(listener);
  return () => {
    installListeners = installListeners.filter((entry) => entry !== listener);
  };
}

function notify(): void {
  for (const listener of installListeners) listener();
}

/** True once running from the home screen, which hides the install prompt for good. */
export function isInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari reports this instead, and never fires beforeinstallprompt.
    (navigator as { standalone?: boolean }).standalone === true
  );
}

/** True when this browser can never show an install prompt, so the UI can explain instead. */
export function needsManualInstall(): boolean {
  if (typeof navigator === 'undefined') return false;
  // iOS Safari: Safari on iOS, and not already standalone.
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return isIos && !isInstalled();
}

export function canInstall(): boolean {
  return installPrompt !== null;
}

/** Shows the browser's own install prompt. Resolves once the player has answered it. */
export async function promptInstall(): Promise<void> {
  const prompt = installPrompt;
  if (!prompt) return;
  installPrompt = null;
  notify();
  await prompt.prompt();
}

/**
 * Applies a waiting update and reloads.
 *
 * Only ever called from a deliberate player action. Reloading on its own would not be enough:
 * the waiting worker stays dormant until it is told to activate, so a bare reload would simply
 * serve the old precache again. `updateSW` posts that message, and the reload waits for the new
 * worker to actually take control.
 *
 * The board lives in localStorage, so the reload costs at most the current animation, never the
 * game.
 */
let activateUpdate: ((reloadPage?: boolean) => Promise<void>) | null = null;

export function applyUpdate(): void {
  if (!activateUpdate) {
    window.location.reload();
    return;
  }
  // The new worker takes control, and only then does the page reload with the new cache.
  void activateUpdate(true);
}

export function startPwa(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('beforeinstallprompt', (event) => {
    // Chromium offers this before install; Safari never does, which needsManualInstall covers.
    event.preventDefault();
    installPrompt = event as Event & { prompt: () => Promise<void> };
    notify();
  });

  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    notify();
  });

  // registerSW returns the function that tells a waiting worker to activate. It is kept so
  // applyUpdate can use it instead of reloading into the stale cache.
  activateUpdate = registerSW({
    immediate: true,
    onNeedRefresh() {
      // A new version is precached and waiting. Nothing happens until the player accepts.
      onUpdateReady?.();
    },
  });
}

/** Lets the app register the update listener. Called once by the component that shows the toast. */
export function setUpdateListener(listener: (() => void) | null): void {
  onUpdateReady = listener;
}
