import type { CSSProperties } from "react";

/** How long tiles take to slide. The move lock in a later step uses this same number. */
export const SLIDE_MS = 150;

/** Fast start, gentle stop: a push followed by friction. */
export const SLIDE_EASE = "cubic-bezier(0.33, 1, 0.68, 1)";

/** CSS custom properties that hand the constants above to the stylesheets. */
export const motionVars = {
  "--slide-ms": `${SLIDE_MS}ms`,
  "--slide-ease": SLIDE_EASE,
} as CSSProperties;
