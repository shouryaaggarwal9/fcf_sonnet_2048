import { describe, expect, it } from 'vitest';
import { motionLabel, parseMotionPreference, prefersReducedMotion } from './motionPreference';

describe('prefersReducedMotion', () => {
  it('follows the OS when set to system', () => {
    expect(prefersReducedMotion('system', true)).toBe(true);
    expect(prefersReducedMotion('system', false)).toBe(false);
  });

  it('always reduces when the player asked for it, whatever the OS says', () => {
    expect(prefersReducedMotion('reduce', false)).toBe(true);
    expect(prefersReducedMotion('reduce', true)).toBe(true);
  });

  it('always animates when the player asked for full motion', () => {
    // A deliberate in-app override of the OS setting, which is what "override" means.
    expect(prefersReducedMotion('full', true)).toBe(false);
    expect(prefersReducedMotion('full', false)).toBe(false);
  });

  it('honours an OS that asks for less when the player has not chosen', () => {
    expect(prefersReducedMotion('system', true)).toBe(true);
  });
});

describe('parseMotionPreference', () => {
  it('accepts the three real values', () => {
    for (const value of ['system', 'reduce', 'full']) {
      expect(parseMotionPreference(value)).toBe(value);
    }
  });

  it('falls back to following the system for anything else', () => {
    for (const value of ['', 'none', 'REDUCE', 1, true, null, undefined, {}]) {
      expect(parseMotionPreference(value)).toBe('system');
    }
  });
});

describe('motionLabel', () => {
  it('names each option', () => {
    expect(motionLabel('system')).toBe('Match system');
    expect(motionLabel('reduce')).toBe('Reduced');
    expect(motionLabel('full')).toBe('Full');
  });
});
