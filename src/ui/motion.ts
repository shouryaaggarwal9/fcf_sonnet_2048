import type { CSSProperties } from 'react';

/** How long tiles take to slide. The move lock in a later step uses this same number. */
export const SLIDE_MS = 150;

/** Fast start, gentle stop: a push followed by friction. */
export const SLIDE_EASE = 'cubic-bezier(0.33, 1, 0.68, 1)';

/** Spawn: a quiet arrival. Starts when the slide ends. */
export const SPAWN_MS = 180;

/** Merge pop: a small impact. Starts when the slide ends. */
export const POP_MS = 200;

/** The win/game-over overlay fading in, once the board has finished moving. */
export const OVERLAY_FADE_MS = 200;

/** How long a floating "+N" takes to rise off the Score box and fade out. */
export const SCORE_GAIN_MS = 520;

/** Replaces every slide, pop and spawn when the player asked for less movement. */
export const REDUCED_FADE_MS = 120;

/**
 * How long after a move the board still looks like it is moving: the slide, then the
 * longest effect that begins when it ends. The overlay waits exactly this long, so the
 * player always sees the final board before it is covered.
 */
export const SETTLE_MS = SLIDE_MS + Math.max(SPAWN_MS, POP_MS);

/** The same wait, for players who asked for reduced motion: there is no slide to watch. */
export function moveSettleMs(reducedMotion: boolean): number {
  return reducedMotion ? 0 : SETTLE_MS;
}

/** CSS custom properties that hand the constants above to the stylesheets. */
export const motionVars = {
  '--slide-ms': `${SLIDE_MS}ms`,
  '--slide-ease': SLIDE_EASE,
  '--spawn-ms': `${SPAWN_MS}ms`,
  '--pop-ms': `${POP_MS}ms`,
  '--overlay-fade-ms': `${OVERLAY_FADE_MS}ms`,
  '--gain-ms': `${SCORE_GAIN_MS}ms`,
  '--fade-ms': `${REDUCED_FADE_MS}ms`,
  '--settle-ms': `${moveSettleMs(false)}ms`,
  '--settle-ms-reduced': `${moveSettleMs(true)}ms`,
} as CSSProperties;
