// Vector traversal paths (§5). Returns pitch classes read along a path.
// NOTE: P/I/R/RI carry serial meaning only for the Schoenberg matrix; for the
// Stravinsky array they are neutral geometry (row/column/diagonal reads).

import type { Matrix, PitchClass, Path } from '../types';

/**
 * Extract a length-N vector from a matrix.
 * - P  / R : row `index` forward / backward
 * - I  / RI: column `index` downward / upward
 * - diagDown: (0,0)->(N-1,N-1)   diagUp: (0,N-1)->(N-1,0)
 * `index` is ignored for the diagonals.
 */
export function extract(matrix: Matrix, path: Path, index = 0): PitchClass[] {
  const { n, cells } = matrix;
  const y = ((index % n) + n) % n;
  const x = y;
  switch (path) {
    case 'P':
      return cells[y].slice();
    case 'R':
      return cells[y].slice().reverse();
    case 'I':
      return cells.map((row) => row[x]);
    case 'RI':
      return cells.map((row) => row[x]).reverse();
    case 'diagDown':
      return cells.map((row, i) => row[i]);
    case 'diagUp':
      return cells.map((row, i) => row[n - 1 - i]);
  }
}
