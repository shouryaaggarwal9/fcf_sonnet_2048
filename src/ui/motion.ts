import type { CSSProperties } from 'react';

/** How long tiles take to slide. The move lock in a later step uses this same number. */
export const SLIDE_MS = 110;

/** Fast start, gentle stop: a push followed by friction. */
export const SLIDE_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

/** CSS custom properties that hand the constants above to the stylesheets. */
export const motionVars = {
  '--slide-ms': `${SLIDE_MS}ms`,
  '--slide-ease': SLIDE_EASE,
} as CSSProperties;
