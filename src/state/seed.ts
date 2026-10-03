/**
 * Reading a seed from the URL.
 *
 * The engine is fully deterministic, so a seed names one exact game. That is what makes an
 * end-to-end test of a win or a game-over possible at all: there is no other way to reach those
 * states without playing a board that could differ on every run.
 *
 * `?seed=123` starts that game instead of a random one. It is harmless in production, where
 * nobody types it, and it is the hook the Phase 10 daily challenge will build on.
 */

/** The query parameter name. Deliberately short, because it also appears in shared links. */
export const SEED_PARAM = 'seed';

/**
 * The seed from the current URL, or null when there is not a usable one.
 *
 * Strictly validated: the engine coerces its seed with `| 0`, so a float, an empty string, or
 * text would all silently become some other game. Anything that is not a whole number is
 * ignored rather than guessed at.
 */
export function seedFromSearch(search: string): number | null {
  let raw: string | null;
  try {
    raw = new URLSearchParams(search).get(SEED_PARAM);
  } catch {
    return null;
  }
  if (raw === null) return null;

  const trimmed = raw.trim();
  if (trimmed === '' || !/^-?\d+$/.test(trimmed)) return null;

  const value = Number.parseInt(trimmed, 10);
  if (!Number.isSafeInteger(value)) return null;

  // Kept inside the signed 32-bit range the engine works in, so the URL and the engine agree.
  return value | 0;
}

/** The seed for a given location, or null. Takes a location so it stays testable. */
export function seedFromLocation(location: { search: string }): number | null {
  return seedFromSearch(location.search);
}
