// Series construction, validation, and constraint-respecting Randomize (§1.4, §2.3).

import { EDO, mod24 } from './pitch';
import { makeRng } from './rng';
import type { Series } from '../types';
import { VALID_LENGTHS } from '../types';

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

/** Validate a series against the length set and (optionally) the strict flag. */
export function validate(series: Series, strict: boolean): ValidationResult {
  const errors: string[] = [];
  if (!VALID_LENGTHS.includes(series.length as (typeof VALID_LENGTHS)[number])) {
    errors.push(`Length ${series.length} is not one of ${VALID_LENGTHS.join(', ')}`);
  }
  if (series.pitches.length !== series.length) {
    errors.push(`pitches.length (${series.pitches.length}) !== length (${series.length})`);
  }
  for (const p of series.pitches) {
    if (!Number.isInteger(p) || p < 0 || p >= EDO) {
      errors.push(`Pitch ${p} is outside 0..${EDO - 1}`);
    }
  }
  if (strict) {
    const seen = new Set<number>();
    for (const p of series.pitches) {
      if (seen.has(p)) {
        errors.push(`Strict mode: duplicated pitch class ${p}`);
        break;
      }
      seen.add(p);
    }
  }
  return { ok: errors.length === 0, errors };
}

export interface RandomizeOptions {
  semitonesOnly?: boolean; // restrict to even (12-EDO) values
  strict?: boolean; // sample without replacement (all distinct)
  seed: number;
}

/**
 * Generate a random series of length `n` (§1.4). The pitch pool is the full
 * 24-EDO set by default, or the 12 even values when `semitonesOnly`.
 */
export function randomize(n: number, opts: RandomizeOptions): Series {
  const rng = makeRng(opts.seed);
  const pool = opts.semitonesOnly
    ? Array.from({ length: EDO / 2 }, (_, i) => i * 2) // 0,2,4,...,22
    : Array.from({ length: EDO }, (_, i) => i); // 0..23
  const pitches = rng.sample(pool, n, !opts.strict).map(mod24);
  return { length: n, pitches };
}
