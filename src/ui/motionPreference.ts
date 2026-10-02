import type { ThemePreference } from '../state/savedData';

export type MotionPreference = 'system' | 'reduce' | 'full';

const MOTIONS: readonly MotionPreference[] = ['system', 'reduce', 'full'];

/**
 * Whether motion should be reduced, given what the player chose and what the OS asks for.
 *
 * 'system' follows the OS, which is why it is the default: someone who has asked their
/**
 * Whether motion should be reduced, given what the player chose and what the OS asks for.
 *
 * 'system' follows the OS and is the default: someone who has already asked their operating
 * system for less motion should not have to ask this app separately. The two explicit choices
 * override the OS in both directions, because the roadmap calls this an override and because
 * someone who has deliberately set it for this game means it. Choosing Full is therefore a
 * conscious decision to move past an OS-level request, which is why the settings dialog spells
 * that out rather than leaving it as a silent switch.
 */
export function prefersReducedMotion(choice: MotionPreference, systemWantsLess: boolean): boolean {
  if (choice === 'reduce') return true;
  if (choice === 'full') return false;
  return systemWantsLess;
}

/** Narrows an untrusted stored value, falling back to following the system. */
export function parseMotionPreference(value: unknown): MotionPreference {
  return MOTIONS.includes(value as MotionPreference) ? (value as MotionPreference) : 'system';
}

/** The label for a motion preference, for a select or a radio group. */
export function motionLabel(preference: MotionPreference): string {
  switch (preference) {
    case 'reduce':
      return 'Reduced';
    case 'full':
      return 'Full';
    default:
      return 'Match system';
  }
}

export type { ThemePreference };
export { MOTIONS };
