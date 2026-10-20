// Duration engine (§3): palette + permutation. Durations are never "inverted"
// as values; only their deployment ORDER is transformed (Boulez, Structures Ia).

import { EDO, mod24 } from './pitch';
import type { DurationPalette, PitchClass } from '../types';

export interface DurCell {
  mult: number; // positive integer multiple of t0
  silent: boolean; // structural rest (§4.4)
}

export function paletteCells(p: DurationPalette): DurCell[] {
  return p.multipliers.map((mult, i) => ({ mult, silent: p.silent[i] ?? false }));
}

export function reverse(cells: DurCell[]): DurCell[] {
  return cells.slice().reverse();
}

/** Left-rotate a duration sequence by k (cyclic). */
export function rotate(cells: DurCell[], k: number): DurCell[] {
  const n = cells.length;
  const s = ((k % n) + n) % n;
  return cells.map((_, i) => cells[(i + s) % n]);
}

/** Augmentation / diminution: scale every duration by `factor` (>=1 after rounding). */
export function augment(cells: DurCell[], factor: number): DurCell[] {
  return cells.map((c) => ({ ...c, mult: Math.max(1, Math.round(c.mult * factor)) }));
}

/** N rotations of the palette — the independent-mode rotational array. */
export function rotationalArray(cells: DurCell[]): DurCell[][] {
  return cells.map((_, k) => rotate(cells, k));
}

/** Per-voice transform (independent mode): optional reverse, then cyclic rotate. */
export function transformDurations(cells: DurCell[], reverse: boolean, rot: number): DurCell[] {
  const s = reverse ? cells.slice().reverse() : cells.slice();
  return rotate(s, rot);
}

/**
 * Integral (Boulez) coupling, as in Structures Ia: every pitch class carries the
 * order number of its position in the prime, and that number selects its
 * duration. Indexed by pitch class 0..23. A repeated pitch takes its first
 * position. Pitches absent from the prime (transposed forms of a short row
 * leave its collection) take the number of the nearest prime pitch, earlier
 * positions winning ties.
 */
export function orderNumbers(prime: PitchClass[]): number[] {
  return Array.from({ length: EDO }, (_, pc) => {
    let best = 0;
    let bestDist = Infinity;
    prime.forEach((p, i) => {
      const dist = Math.min(mod24(p - pc), mod24(pc - p));
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    return best;
  });
}
