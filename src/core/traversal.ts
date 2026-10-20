// Vector traversal paths (§5). Returns pitch classes read along a path.
// NOTE: P/I/R/RI carry serial meaning only for the Schoenberg matrix; for the
// Stravinsky array they are neutral geometry (row/column/diagonal reads).

import type { Matrix, PitchClass, Path } from '../types';

/** A matrix coordinate: [row y, column x]. */
export type Cell = [number, number];

/**
 * The cells a path visits, in reading order.
 * - P  / R : row `index` forward / backward
 * - I  / RI: column `index` downward / upward
 * - diagDown: (0,0)->(N-1,N-1)   diagUp: (0,N-1)->(N-1,0)
 * `index` wraps modulo N and is ignored for the diagonals.
 */
export function pathCells(n: number, path: Path, index = 0): Cell[] {
  const k = ((index % n) + n) % n;
  const steps = Array.from({ length: n }, (_, i) => i);
  switch (path) {
    case 'P':
      return steps.map((i): Cell => [k, i]);
    case 'R':
      return steps.map((i): Cell => [k, n - 1 - i]);
    case 'I':
      return steps.map((i): Cell => [i, k]);
    case 'RI':
      return steps.map((i): Cell => [n - 1 - i, k]);
    case 'diagDown':
      return steps.map((i): Cell => [i, i]);
    case 'diagUp':
      return steps.map((i): Cell => [i, n - 1 - i]);
  }
}

/** Extract a length-N vector of pitch classes read along a path. */
export function extract(matrix: Matrix, path: Path, index = 0): PitchClass[] {
  return pathCells(matrix.n, path, index).map(([y, x]) => matrix.cells[y][x]);
}
