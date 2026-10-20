import { describe, it, expect } from 'vitest';
import { cellStream, cellDistance } from './extract';
import { schoenberg } from '../core/matrix';
import { pathCells } from '../core/traversal';
import { makeRng } from '../core/rng';

const m = schoenberg([0, 5, 3, 14, 9, 20, 11]);
const n = m.n;

describe('cellStream (determinism walk)', () => {
  it('d = 1 reads the path, advancing the row/column each pass', () => {
    const cells = cellStream(m, 'I', 1, makeRng(1), 2 * n);
    expect(cells).toEqual([...pathCells(n, 'I', 0), ...pathCells(n, 'I', 1)]);
  });

  it('starts every path at its own first cell, even at d = 0', () => {
    for (const path of ['P', 'R', 'I', 'RI'] as const) {
      expect(cellStream(m, path, 0, makeRng(3), 1)[0]).toEqual(pathCells(n, path, 0)[0]);
    }
  });

  it('d = 0 always moves to a neighbour of the previous cell', () => {
    const cells = cellStream(m, 'P', 0, makeRng(7), 200);
    for (let i = 1; i < cells.length; i++) expect(cellDistance(cells[i - 1], cells[i], n)).toBe(1);
  });

  it('hybrid deviations are neighbours of the note just played', () => {
    // Re-run the walk and classify each step by replaying the same random draws.
    for (let seed = 1; seed <= 20; seed++) {
      const d = 0.5;
      const cells = cellStream(m, 'P', d, makeRng(seed), 120);
      const rng = makeRng(seed);
      for (let i = 1; i < cells.length; i++) {
        const systematic = rng.next() < d;
        if (!systematic) {
          rng.int(8); // the neighbour draw
          expect(cellDistance(cells[i - 1], cells[i], n)).toBe(1);
        }
      }
    }
  });
});
