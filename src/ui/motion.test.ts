import { describe, expect, it } from 'vitest';
import {
  moveSettleMs,
  OVERLAY_FADE_MS,
  POP_MS,
  REDUCED_FADE_MS,
  SETTLE_MS,
  SLIDE_MS,
  SPAWN_MS,
} from './motion';

describe('moveSettleMs', () => {
  it('waits for the slide, then the longest effect that starts when it ends', () => {
    // 150ms of slide, then spawn (180) and pop (200) run side by side, so 200 is the long one.
    expect(SETTLE_MS).toBe(SLIDE_MS + Math.max(SPAWN_MS, POP_MS));
    expect(SETTLE_MS).toBe(350);
  });

  it('does not wait at all under reduced motion, where there is no slide to watch', () => {
    expect(moveSettleMs(false)).toBe(SETTLE_MS);
    expect(moveSettleMs(true)).toBe(0);
  });
});

describe('reduced motion still gets a visible fade', () => {
  it('keeps a short fade rather than nothing', () => {
    // The overlay must not pop in instantly, so a reduced-motion fade is a separate constant.
    expect(REDUCED_FADE_MS).toBeLessThan(OVERLAY_FADE_MS);
    expect(REDUCED_FADE_MS).toBeGreaterThan(0);
  });
});
