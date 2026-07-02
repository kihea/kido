// Content-derived ids keep the engine deterministic: the same corpus yields
// the same ids, so replays, tests, and persisted review items all line up.

/** FNV-1a 32-bit over a string, base36 — stable, collision-unlikely at our sizes. */
export function hashId(prefix: string, content: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < content.length; i++) {
    h ^= content.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${prefix}_${(h >>> 0).toString(36)}`;
}

/** Non-deterministic uid for UI-level ephemera only (never inside engine logic). */
export function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
