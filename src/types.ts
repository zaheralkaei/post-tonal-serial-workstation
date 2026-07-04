// Shared domain types for the Post-Tonal Serial Workstation.
// See SPECIFICATION.md (Rev 4). All pitch arithmetic is absolute 24-EDO, mod 24.

/** A pitch class in the 24-EDO space, 0..23. Even = semitone, odd = quarter-tone. */
export type PitchClass = number;

/** A register-resolved pitch: number of quarter-tone steps from a fixed origin (C0 = 0). */
export type AbsPitch = number;

/** Valid series lengths (§1.3). Length is the ONLY structural choice — there are no scales. */
export const VALID_LENGTHS = [5, 6, 7, 8, 9, 10, 11, 12, 24] as const;
export type SeriesLength = (typeof VALID_LENGTHS)[number];

export interface Series {
  length: number; // N; must equal pitches.length
  pitches: PitchClass[]; // each 0..23, repeats allowed unless strict
}

export type MatrixMode = 'schoenberg' | 'stravinsky';

export interface Matrix {
  mode: MatrixMode;
  n: number;
  cells: PitchClass[][]; // cells[y][x]
  prime: PitchClass[]; // row 0
}

/** Serial / geometric read-out paths (§5). */
export type Path = 'P' | 'R' | 'I' | 'RI' | 'diagDown' | 'diagUp';

/** Atomic time unit t0. */
export type NoteValue = '4n' | '8n' | '16n' | '32n';

export interface DurationPalette {
  unit: NoteValue;
  multipliers: number[]; // length N, positive integers
  silent: boolean[]; // length N, structural rests (§4.4)
}

export type DurationMode = 'integral' | 'independent';

export const VOICES = ['violinI', 'violinII', 'viola', 'cello'] as const;
export type VoiceId = (typeof VOICES)[number];

/**
 * Voice allocation (§4.2). Either the user wires each instrument to a specific
 * read-out path, or the engine assigns paths randomly and re-shuffles over time.
 */
export type VoiceAllocation =
  | { mode: 'manual'; map: Record<VoiceId, Path> }
  | { mode: 'random' }; // reshuffles path->voice each measure via the seeded RNG

export interface GenParams {
  matrixMode: MatrixMode;
  durationMode: DurationMode;
  strict: boolean; // §2.3 non-repetition
  determinism: number; // 0..1 (§4.2)
  restProbability: number; // 0..1 (§4.4)
  minVoices: 0 | 1 | 2 | 3; // default 1
  dispersion: number; // D_reg 0..1 (§4.3)
  voiceLeading: boolean;
  voiceAllocation: VoiceAllocation;
  tempoBpm: number; // 40..240
  meter: 'static' | 'variable';
  timeSignature?: [number, number];
  measureCount: number;
  seed: number;
}

/** A single timed event. `pitch === undefined` means a rest. */
export interface NoteEvent {
  startUnits: number; // onset in t0 units
  durUnits: number;
  pitch?: AbsPitch;
  velocity?: number; // 0..1
}

/**
 * The intermediate representation consumed by BOTH the audio scheduler and the
 * MusicXML exporter — the single source of truth for a generated piece.
 */
export interface ScoreModel {
  unit: NoteValue;
  tempoBpm: number;
  voices: Record<VoiceId, NoteEvent[]>;
  meters: [number, number][]; // per measure
}
