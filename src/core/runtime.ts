// Injected runtime dependencies. Engine logic never calls Date.now() or
// Math.random() directly — determinism is what makes sessions replayable and
// the engine's choices testable (docs/ARCHITECTURE.md, determinism policy).

export type Clock = () => number; // epoch ms
export type Rng = () => number; // [0, 1)

export const systemClock: Clock = () => Date.now();

/** mulberry32 — small, fast, deterministic. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic shuffle (Fisher–Yates over a copy). */
export function shuffled<T>(items: readonly T[], rng: Rng): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = out[i]!;
    out[i] = out[j]!;
    out[j] = a;
  }
  return out;
}
