// Duration engine (§3): palette + permutation. Durations are never "inverted"
// as values; only their deployment ORDER is transformed (Boulez, Structures Ia).

import type { DurationPalette, Path } from '../types';

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

/**
 * Integral (Boulez) coupling: the palette follows the read direction of the
 * pitch path. Forward reads (P, I, diagDown) use the palette as-is; reverse
 * reads (R, RI, diagUp) use it reversed. Durations track pitch transform.
 */
export function integralFor(cells: DurCell[], path: Path): DurCell[] {
  const reversed = path === 'R' || path === 'RI' || path === 'diagUp';
  return reversed ? reverse(cells) : cells.slice();
}
