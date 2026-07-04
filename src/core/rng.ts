// Seeded, deterministic PRNG (mulberry32) so a (params, seed) pair always
// reproduces the same series and the same stochastic arrangement (§1.4).

export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [0, max). */
  int(max: number): number;
  /** Pick `k` items from `arr`; with/without replacement. */
  sample<T>(arr: readonly T[], k: number, replace: boolean): T[];
  /** In-place Fisher–Yates shuffle, returning a new array. */
  shuffle<T>(arr: readonly T[]): T[];
}

export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (max: number): number => Math.floor(next() * max);

  const shuffle = <T>(arr: readonly T[]): T[] => {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = int(i + 1);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };

  const sample = <T>(arr: readonly T[], k: number, replace: boolean): T[] => {
    if (replace) {
      const out: T[] = [];
      for (let i = 0; i < k; i++) out.push(arr[int(arr.length)]);
      return out;
    }
    if (k > arr.length) {
      throw new Error(`Cannot sample ${k} distinct items from ${arr.length}`);
    }
    return shuffle(arr).slice(0, k);
  };

  return { next, int, sample, shuffle };
}
