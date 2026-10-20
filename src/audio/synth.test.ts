import { describe, it, expect } from 'vitest';
import { envelopeTimes, freq } from './synth';

describe('envelopeTimes', () => {
  it('keeps attack and release inside the note for every length', () => {
    for (const d of [0.01, 0.02, 0.03, 0.06, 0.1, 0.2, 0.5, 1, 4]) {
      const { attack, release } = envelopeTimes(d);
      expect(attack + release).toBeLessThanOrEqual(d);
      expect(attack).toBeGreaterThan(0);
    }
  });

  it('uses the full bow attack on long notes', () => {
    expect(envelopeTimes(1).attack).toBe(0.05);
  });
});

describe('freq', () => {
  it('maps A4 and quarter-tones correctly', () => {
    expect(freq(114)).toBeCloseTo(440, 6);
    expect(freq(115)).toBeCloseTo(440 * 2 ** (1 / 24), 6);
  });
});
