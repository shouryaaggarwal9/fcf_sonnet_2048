import { useGameStore } from '../state/gameStore';
import type { ThemePreference } from '../state/savedData';
import { Modal } from './Modal';
import { MOTIONS, type MotionPreference, motionLabel } from './motionPreference';
import { InstallRow } from './UpdateToast';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  /** Whether the OS currently asks for reduced motion, shown as context. */
  systemWantsLess: boolean;
}

const THEMES: readonly { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'Match system' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/**
 * Settings: theme, the on-screen direction pad, and how much motion to use.
 *
 * Uses radio groups rather than selects, so the choices are all visible at once and reachable
 * with arrow keys, which a collapsed <select> is not on every platform.
 */
export function SettingsDialog({ open, onClose, systemWantsLess }: SettingsDialogProps) {
  const settings = useGameStore((state) => state.settings);
  const setTheme = useGameStore((state) => state.setTheme);
  const setDpad = useGameStore((state) => state.setDpad);
  const setMotion = useGameStore((state) => state.setMotion);

  return (
    <Modal open={open} title="Settings" onClose={onClose}>
      <fieldset className="settings-group">
        <legend className="settings-legend">Theme</legend>
        <div className="settings-options">
          {THEMES.map((theme) => (
            <label key={theme.value} className="settings-option">
              <input
                type="radio"
                name="theme"
                value={theme.value}
                checked={settings.theme === theme.value}
                onChange={() => setTheme(theme.value)}
              />
              <span>{theme.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="settings-group">
        <legend className="settings-legend">Direction pad</legend>
        <label className="settings-option">
          <input
            type="checkbox"
            checked={settings.dpad}
            onChange={(event) => setDpad(event.target.checked)}
          />
          <span>Show on-screen arrows</span>
        </label>
        <p className="settings-hint">
          Swiping and the keyboard already move tiles. This adds tap buttons, for anyone who cannot
          swipe or has no keyboard.
        </p>
      </fieldset>

      <fieldset className="settings-group">
        <legend className="settings-legend">Motion</legend>
        <div className="settings-options">
          {MOTIONS.map((motion) => (
            <label key={motion} className="settings-option">
              <input
                type="radio"
                name="motion"
                value={motion}
                checked={settings.motion === motion}
                onChange={() => setMotion(motion)}
              />
              <span>{motionLabel(motion as MotionPreference)}</span>
            </label>
          ))}
        </div>
        <p className="settings-hint">
          Reduced removes the slide and pop animations, leaving short fades.
          {systemWantsLess
            ? ' Your system is currently asking for reduced motion.'
            : ' Your system is not currently asking for reduced motion.'}
        </p>
      </fieldset>

      <fieldset className="settings-group">
        <legend className="settings-legend">Install</legend>
        <InstallRow />
      </fieldset>
    </Modal>
  );
}
