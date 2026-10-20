// Determinism axis (§4.2): produce a pitch-class stream for one voice from a
// matrix. d=1 exhausts systematic paths; d=0 is a random walk; 0<d<1 mixes.

import type { Matrix, Path, PitchClass } from '../types';
import type { Rng } from '../core/rng';
import { pathCells, type Cell } from '../core/traversal';

// The eight neighbours of a cell; a deviation always moves.
const NEIGHBOURS: Cell[] = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1],
];

const wrap = (v: number, n: number) => ((v % n) + n) % n;

/** Distance between two cells on the wrapped (toroidal) grid, in king moves. */
export function cellDistance(a: Cell, b: Cell, n: number): number {
  const d = (p: number, q: number) => Math.min(Math.abs(p - q), n - Math.abs(p - q));
  return Math.max(d(a[0], b[0]), d(a[1], b[1]));
}

/**
 * Generate the cells a voice visits. One cursor drives both components:
 * - Systematic (prob d): the next cell on the path. The row/column index
 *   advances each time a vector is exhausted, so successive passes differ.
 * - Deviation (prob 1-d): a one-step move to a neighbour of the cell just
 *   played. The systematic read then resumes at the nearest cell still ahead
 *   on the current vector (after it, if the walk landed exactly on it).
 * The first cell is always the start of the path.
 */
export function cellStream(
  matrix: Matrix,
  path: Path,
  determinism: number,
  rng: Rng,
  count: number,
): Cell[] {
  const { n } = matrix;
  const out: Cell[] = [];
  let pass = 0;
  let queue = pathCells(n, path, pass);
  let next = 0; // index in `queue` of the next systematic cell
  let cur: Cell | null = null;

  for (let i = 0; i < count; i++) {
    let cell: Cell;
    if (cur === null || rng.next() < determinism) {
      if (next >= queue.length) {
        pass += 1;
        queue = pathCells(n, path, pass);
        next = 0;
      }
      cell = queue[next++];
    } else {
      const [dy, dx] = NEIGHBOURS[rng.int(NEIGHBOURS.length)];
      cell = [wrap(cur[0] + dy, n), wrap(cur[1] + dx, n)];
      let bestJ = next;
      let bestD = Infinity;
      for (let j = next; j < queue.length; j++) {
        const dist = cellDistance(cell, queue[j], n);
        if (dist < bestD) {
          bestD = dist;
          bestJ = j;
        }
      }
      next = bestD === 0 ? bestJ + 1 : bestJ;
    }
    out.push(cell);
    cur = cell;
  }
  return out;
}

/** The pitch classes of `cellStream`. */
export function pitchStream(
  matrix: Matrix,
  path: Path,
  determinism: number,
  rng: Rng,
  count: number,
): PitchClass[] {
  return cellStream(matrix, path, determinism, rng, count).map(([y, x]) => matrix.cells[y][x]);
}
