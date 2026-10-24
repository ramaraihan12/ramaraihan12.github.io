/*
  Seeded randomness for the art kit. Everything that wobbles is drawn from a seed, never from
  Math.random, so the server and the browser draw the same lines and hydration stays quiet.
*/

export type Rand = () => number;

/** mulberry32: tiny, fast, good enough for jitter. Returns floats in [0, 1). */
export function rng(seed: number): Rand {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a, for turning a name or a key into a seed. */
export function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A value in [-amount, amount]. */
export const wobble = (r: Rand, amount: number) => (r() * 2 - 1) * amount;

/** A value in [min, max). */
export const between = (r: Rand, min: number, max: number) => min + (max - min) * r();

/**
 * A stand-in for a real embedding: n values, roughly normal around 0 with the spread of the
 * qwen3 vectors in retrieval.json (most within ±0.1, a few out to ±0.2). Deterministic.
 */
export function fakeVector(n = 1024, seed = 7): number[] {
  const r = rng(seed);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    // Box-Muller, with the odd spike that real embeddings have.
    const g = Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
    const spike = r() < 0.03 ? 2.4 : 1;
    out.push(Math.max(-0.22, Math.min(0.22, g * 0.045 * spike)));
  }
  return out;
}
