// Determinism axis (§4.2): produce a pitch-class stream for one voice from a
// matrix. d=1 exhausts systematic paths; d=0 is a random walk; 0<d<1 mixes.

import type { Matrix, Path, PitchClass } from '../types';
import type { Rng } from '../core/rng';
import { extract } from '../core/traversal';

interface Cursor {
  y: number;
  x: number;
}

const clamp = (v: number, n: number) => ((v % n) + n) % n;

/**
 * Generate `count` pitch classes for a voice.
 * - Systematic component: read the voice's `path`, cycling the row/column index
 *   each time the vector is exhausted so successive passes differ.
 * - Deviation component (prob 1-d): a one-step walk to an adjacent cell.
 */
export function pitchStream(
  matrix: Matrix,
  path: Path,
  determinism: number,
  rng: Rng,
  count: number,
): PitchClass[] {
  const { n, cells } = matrix;
  const out: PitchClass[] = [];

  // Precompute the systematic queue (cycled index passes).
  let pass = 0;
  let vec = extract(matrix, path, pass);
  let vi = 0;
  const cur: Cursor = { y: 0, x: 0 };

  const advanceSystematic = (): PitchClass => {
    if (vi >= vec.length) {
      pass = clamp(pass + 1, n);
      vec = extract(matrix, path, pass);
      vi = 0;
    }
    const v = vec[vi++];
    return v;
  };

  const step = [-1, 0, 1];
  const deviate = (): PitchClass => {
    // one-step walk to an adjacent (incl. diagonal) cell within the block
    const dy = step[rng.int(3)];
    const dx = step[rng.int(3)];
    cur.y = clamp(cur.y + dy, n);
    cur.x = clamp(cur.x + dx, n);
    return cells[cur.y][cur.x];
  };

  for (let i = 0; i < count; i++) {
    if (rng.next() < determinism) {
      out.push(advanceSystematic());
    } else {
      out.push(deviate());
    }
  }
  return out;
}
