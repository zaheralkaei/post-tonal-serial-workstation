// Register mapping (§4.3): abstract pitch class -> absolute pitch within an
// instrument range, governed by the Registral Dispersion parameter D_reg.
//
// AbsPitch is measured in quarter-tone steps from C0 (so one octave = 24).

import { EDO } from '../core/pitch';
import type { AbsPitch, PitchClass, VoiceId } from '../types';

export interface Range {
  prefLo: AbsPitch;
  prefHi: AbsPitch;
  absLo: AbsPitch;
  absHi: AbsPitch;
}

// Helper: quarter-tone steps from C0 for a semitone MIDI-like octave.
const oct = (o: number) => o * EDO;
const semi = (s: number) => s * 2; // semitones -> quarter-tone steps

// Preferred bands from the spec; absolute bands are the instruments' real limits.
export const INSTRUMENT_RANGES: Record<VoiceId, Range> = {
  // Violin I preferred C5–E7; absolute G3–A7.
  violinI: { prefLo: oct(5), prefHi: oct(7) + semi(4), absLo: oct(3) + semi(7), absHi: oct(7) + semi(9) },
  // Violin II preferred G3–A5; absolute G3–A7.
  violinII: { prefLo: oct(3) + semi(7), prefHi: oct(5) + semi(9), absLo: oct(3) + semi(7), absHi: oct(7) + semi(9) },
  // Viola preferred C3–E5; absolute C3–E6.
  viola: { prefLo: oct(3), prefHi: oct(5) + semi(4), absLo: oct(3), absHi: oct(6) + semi(4) },
  // Cello preferred C2–G4; absolute C2–C6.
  cello: { prefLo: oct(2), prefHi: oct(4) + semi(7), absLo: oct(2), absHi: oct(6) },
};

const clampByOctave = (abs: number, lo: number, hi: number): number => {
  let v = abs;
  while (v < lo) v += EDO;
  while (v > hi) v -= EDO;
  // If the range is narrower than an octave the note may still fall outside;
  // clamp to the nearer bound as a last resort.
  if (v < lo) v = lo;
  if (v > hi) v = hi;
  return v;
};

const nearestOctave = (pc: number, target: number): number =>
  Math.round((target - pc) / EDO);

/**
 * Place a pitch class into a concrete octave for a voice.
 * @param prev previous absolute pitch in this voice (for smooth motion)
 * @param dispersion D_reg in [0,1]: 0 = minimize leap, 1 = linear spread.
 */
export function placeOctave(
  pc: PitchClass,
  prev: AbsPitch | null,
  range: Range,
  dispersion: number,
): AbsPitch {
  const midPref = (range.prefLo + range.prefHi) / 2;
  const smoothOct = nearestOctave(pc, prev ?? midPref);
  const linearTarget = range.prefLo + (pc / (EDO - 1)) * (range.prefHi - range.prefLo);
  const linearOct = nearestOctave(pc, linearTarget);
  const o = Math.round((1 - dispersion) * smoothOct + dispersion * linearOct);
  const abs = pc + o * EDO;
  return clampByOctave(abs, range.absLo, range.absHi);
}

/**
 * Voice-leading safeguard (§4.3): if the leap from prev exceeds an octave, pull
 * it back by octaves while staying in range. Relaxed at high dispersion.
 */
export function smoothLeap(
  abs: AbsPitch,
  prev: AbsPitch | null,
  range: Range,
  dispersion: number,
): AbsPitch {
  if (prev === null || dispersion >= 0.5) return abs;
  let v = abs;
  while (v - prev > EDO && v - EDO >= range.absLo) v -= EDO;
  while (prev - v > EDO && v + EDO <= range.absHi) v += EDO;
  return v;
}
