/** Tiers 1..11 are 2..2048. Everything bigger shares the last tier (the "super" color). */
export const MAX_TIER = 12;

/** 2 → 1, 4 → 2, ... 2048 → 11, 4096 and above → 12. */
export function tileTier(value: number): number {
  return Math.min(Math.max(Math.round(Math.log2(value)), 1), MAX_TIER);
}
