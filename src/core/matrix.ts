// Matrix generators (§2). All arithmetic is absolute 24-EDO, mod 24.

import { mod24, invert, transpose } from './pitch';
import type { Matrix, PitchClass, Series } from '../types';

/**
 * Inversion vector I0 anchored so I0[0] === P0[0] (§2.1):
 *   I0[i] = (2*P0[0] - P0[i]) mod 24
 */
export function inversionVector(prime: PitchClass[]): PitchClass[] {
  const axis = prime[0];
  return prime.map((p) => invert(p, axis));
}

/**
 * Mode A — Schoenberg matrix (§2.1). Row y is the prime transposed so its first
 * pitch equals I0[y]. Row 0 === prime; the main diagonal is constant (= P0[0]);
 * reading a column top->bottom yields an inversion.
 */
export function schoenberg(prime: PitchClass[]): Matrix {
  const n = prime.length;
  const i0 = inversionVector(prime);
  const cells: PitchClass[][] = [];
  for (let y = 0; y < n; y++) {
    const t = mod24(i0[y] - prime[0]); // transpose amount so row starts on I0[y]
    cells.push(prime.map((p) => transpose(p, t)));
  }
  return { mode: 'schoenberg', n, cells, prime: prime.slice() };
}

/**
 * Mode B — Stravinsky rotational array (§2.2). Row k is `prime` left-rotated by
 * k, then transposed so its new index-0 pitch equals prime[0]. Row 0 === prime;
 * every row begins on prime[0].
 */
export function stravinsky(prime: PitchClass[]): Matrix {
  const n = prime.length;
  const cells: PitchClass[][] = [];
  for (let k = 0; k < n; k++) {
    const rotated = prime.map((_, i) => prime[(i + k) % n]);
    const t = mod24(prime[0] - rotated[0]);
    cells.push(rotated.map((p) => transpose(p, t)));
  }
  return { mode: 'stravinsky', n, cells, prime: prime.slice() };
}

export function buildMatrix(series: Series, mode: Matrix['mode']): Matrix {
  return mode === 'schoenberg' ? schoenberg(series.pitches) : stravinsky(series.pitches);
}
