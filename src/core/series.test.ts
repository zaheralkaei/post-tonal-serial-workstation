import { describe, it, expect } from 'vitest';
import { validate, randomize } from './series';

describe('validate', () => {
  it('accepts a valid non-strict series with repeats', () => {
    const r = validate({ length: 5, pitches: [0, 0, 3, 14, 9] }, false);
    expect(r.ok).toBe(true);
  });

  it('rejects repeats in strict mode', () => {
    const r = validate({ length: 5, pitches: [0, 0, 3, 14, 9] }, true);
    expect(r.ok).toBe(false);
  });

  it('rejects invalid length', () => {
    const r = validate({ length: 13, pitches: new Array(13).fill(0) }, false);
    expect(r.ok).toBe(false);
  });

  it('rejects out-of-range pitches', () => {
    const r = validate({ length: 5, pitches: [0, 24, 3, 14, 9] }, false);
    expect(r.ok).toBe(false);
  });
});

describe('randomize', () => {
  it('is reproducible for a given seed', () => {
    const a = randomize(7, { seed: 42 });
    const b = randomize(7, { seed: 42 });
    expect(a.pitches).toEqual(b.pitches);
  });

  it('respects length and range', () => {
    const s = randomize(9, { seed: 1 });
    expect(s.pitches.length).toBe(9);
    for (const p of s.pitches) expect(p >= 0 && p < 24).toBe(true);
  });

  it('semitonesOnly yields only even values', () => {
    const s = randomize(6, { seed: 7, semitonesOnly: true });
    for (const p of s.pitches) expect(p % 2).toBe(0);
  });

  it('strict yields distinct pitches', () => {
    const s = randomize(12, { seed: 3, strict: true });
    expect(new Set(s.pitches).size).toBe(12);
  });
});
