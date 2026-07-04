// Absolute 24-EDO pitch arithmetic (§1.1). Everything is mod 24.

export const EDO = 24;

/** True modulo (always non-negative), unlike JS `%`. */
export function mod24(x: number): number {
  return ((x % EDO) + EDO) % EDO;
}

/** Transpose a pitch class by `t` quarter-tone steps. */
export function transpose(p: number, t: number): number {
  return mod24(p + t);
}

/**
 * Invert a pitch class about an axis (§2.1). The inversion that maps `axis`
 * onto itself is I(p) = 2*axis - p (mod 24).
 */
export function invert(p: number, axis: number): number {
  return mod24(2 * axis - p);
}

/** Whether a pitch class is a quarter-tone (odd value). */
export function isQuarterTone(p: number): boolean {
  return mod24(p) % 2 === 1;
}
