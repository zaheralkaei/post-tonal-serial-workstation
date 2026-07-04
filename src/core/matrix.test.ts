import { describe, it, expect } from 'vitest';
import { schoenberg, stravinsky, inversionVector } from './matrix';
import { extract } from './traversal';
import { mod24 } from './pitch';

// A canonical prime for checks (semitone values in 24-EDO: 0,2,4,...,22 = chromatic row).
const chromatic12 = Array.from({ length: 12 }, (_, i) => i * 2);
// A short mixed row including a quarter-tone.
const short = [0, 5, 3, 14, 9]; // note 3 and 5 are quarter-tones

describe('inversionVector', () => {
  it('anchors so I0[0] === P0[0]', () => {
    const i0 = inversionVector(short);
    expect(i0[0]).toBe(short[0]);
  });
});

describe('schoenberg matrix', () => {
  it('row 0 equals the prime', () => {
    const m = schoenberg(short);
    expect(m.cells[0]).toEqual(short);
  });

  it('main diagonal is constant and equals P0[0]', () => {
    const m = schoenberg(short);
    for (let i = 0; i < m.n; i++) expect(m.cells[i][i]).toBe(short[0]);
  });

  it('leftmost column spells the inversion vector', () => {
    const m = schoenberg(short);
    const col0 = m.cells.map((row) => row[0]);
    expect(col0).toEqual(inversionVector(short));
  });

  it('reading a column top->bottom is an inversion of the prime', () => {
    const m = schoenberg(chromatic12);
    // Column x, read down, should be an inversion starting on cells[0][x].
    const x = 3;
    const colDown = extract(m, 'I', x);
    // colDown is the vertical read; its first element matches the top cell.
    expect(colDown[0]).toBe(m.cells[0][x]);
    // And each column value equals 2*colDown[0]-... is complex; instead verify
    // the well-known relation: cells[y][x] = P0[x] + I0[y] - P0[0] (mod 24).
    for (let y = 0; y < m.n; y++) {
      const expected = mod24(chromatic12[x] + inversionVector(chromatic12)[y] - chromatic12[0]);
      expect(m.cells[y][x]).toBe(expected);
    }
  });
});

describe('stravinsky array', () => {
  it('row 0 equals the prime', () => {
    const m = stravinsky(short);
    expect(m.cells[0]).toEqual(short);
  });

  it('every row starts on prime[0]', () => {
    const m = stravinsky(short);
    for (let k = 0; k < m.n; k++) expect(m.cells[k][0]).toBe(short[0]);
  });

  it('row k is a transposed left-rotation by k', () => {
    const m = stravinsky(short);
    const k = 2;
    const rotated = short.map((_, i) => short[(i + k) % short.length]);
    const t = mod24(short[0] - rotated[0]);
    expect(m.cells[k]).toEqual(rotated.map((p) => mod24(p + t)));
  });
});

describe('traversal', () => {
  it('R is the reverse of P', () => {
    const m = schoenberg(short);
    expect(extract(m, 'R', 1)).toEqual(extract(m, 'P', 1).slice().reverse());
  });

  it('RI is the reverse of I', () => {
    const m = schoenberg(short);
    expect(extract(m, 'RI', 2)).toEqual(extract(m, 'I', 2).slice().reverse());
  });

  it('diagonals have length N and pick the expected corners', () => {
    const m = schoenberg(short);
    const dd = extract(m, 'diagDown');
    const du = extract(m, 'diagUp');
    expect(dd.length).toBe(m.n);
    expect(dd[0]).toBe(m.cells[0][0]);
    expect(du[0]).toBe(m.cells[0][m.n - 1]);
  });
});
