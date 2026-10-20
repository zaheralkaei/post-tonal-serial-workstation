import { describe, it, expect } from 'vitest';
import { placeOctave, INSTRUMENT_RANGES } from './register';

describe('placeOctave', () => {
  it('a smooth line stays near the preferred band instead of drifting', () => {
    // A rising chain of major thirds climbs to the instrument's ceiling if only
    // the leap matters (the old behaviour). Small excursions past a soft band
    // edge are fine; drifting away is not.
    const WHOLE_TONE = 4; // quarter-tone steps
    for (const voice of ['violinI', 'violinII', 'viola', 'cello'] as const) {
      const r = INSTRUMENT_RANGES[voice];
      let prev: number | null = null;
      for (let i = 0; i < 60; i++) {
        const pc = (i * 8) % 24;
        const abs = placeOctave(pc, prev, r, 0);
        expect(abs).toBeGreaterThanOrEqual(r.prefLo - WHOLE_TONE);
        expect(abs).toBeLessThanOrEqual(r.prefHi + WHOLE_TONE);
        if (prev !== null) expect(Math.abs(abs - prev)).toBeLessThanOrEqual(24);
        prev = abs;
      }
    }
  });

  it('dispersion 1 lets the pitch class alone fix the register', () => {
    const r = INSTRUMENT_RANGES.viola;
    expect(placeOctave(23, r.prefLo, r, 1)).toBeGreaterThan(placeOctave(0, r.prefHi, r, 1));
  });
});
