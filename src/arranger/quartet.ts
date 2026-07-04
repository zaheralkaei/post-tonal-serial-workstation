// Quartet assembler (§4): turns a matrix + duration palette + params into a
// ScoreModel — the single IR consumed by audio and MusicXML export.

import type {
  DurationPalette,
  GenParams,
  Matrix,
  NoteEvent,
  Path,
  ScoreModel,
  VoiceId,
} from '../types';
import { VOICES } from '../types';
import { makeRng } from '../core/rng';
import { paletteCells, integralFor, transformDurations, rotate, type DurCell } from '../core/duration';
import { pitchStream } from './extract';
import { applyStochasticRests } from './rests';
import { INSTRUMENT_RANGES, placeOctave, smoothLeap } from './register';

const UNIT_DEN: Record<DurationPalette['unit'], number> = {
  '4n': 4,
  '8n': 8,
  '16n': 16,
  '32n': 32,
};

// The four canonical read-out paths cycled through in random allocation.
const CANONICAL_PATHS: Path[] = ['P', 'I', 'R', 'RI'];

interface MeasurePlan {
  capUnits: number;
  meter: [number, number];
  start: number; // absolute onset in t0 units
}

function planMeasures(palette: DurationPalette, params: GenParams): MeasurePlan[] {
  const unitDen = UNIT_DEN[palette.unit];
  const plans: MeasurePlan[] = [];
  let start = 0;
  if (params.meter === 'static') {
    const [num, den] = params.timeSignature ?? [4, 4];
    const cap = Math.max(1, Math.round((num * unitDen) / den));
    for (let m = 0; m < params.measureCount; m++) {
      plans.push({ capUnits: cap, meter: [num, den], start });
      start += cap;
    }
  } else {
    // Variable: measure m capacity = sum of the m-th rotation of the palette.
    const base = paletteCells(palette);
    for (let m = 0; m < params.measureCount; m++) {
      const vec = rotate(base, m);
      const cap = Math.max(1, vec.reduce((s, c) => s + c.mult, 0));
      plans.push({ capUnits: cap, meter: [cap, unitDen], start });
      start += cap;
    }
  }
  return plans;
}

/**
 * Duration sequence for one voice at one moment.
 * - Integral: follows the voice's current pitch path direction (Boulez coupling).
 * - Independent: the voice's own transform (reverse / rotate), so parts can run
 *   the rhythm out of sync — e.g. Cello reversed against Violin I forward.
 */
function durationSequenceFor(
  base: DurCell[],
  params: GenParams,
  path: Path,
  voice: VoiceId,
): DurCell[] {
  if (params.durationMode === 'integral') {
    return integralFor(base, path);
  }
  const tf = params.durationTransforms[voice];
  return transformDurations(base, tf.reverse, tf.rotate);
}

function measureIndexAt(plans: MeasurePlan[], t: number): number {
  for (let m = plans.length - 1; m >= 0; m--) {
    if (t >= plans[m].start) return m;
  }
  return 0;
}

function pathForVoice(
  voice: VoiceId,
  measure: number,
  params: GenParams,
  perMeasurePaths: Path[][],
): Path {
  if (params.voiceAllocation.mode === 'manual') {
    return params.voiceAllocation.map[voice];
  }
  const vi = VOICES.indexOf(voice);
  return perMeasurePaths[measure][vi];
}

export function assemble(matrix: Matrix, palette: DurationPalette, params: GenParams): ScoreModel {
  const rng = makeRng(params.seed);
  const plans = planMeasures(palette, params);
  const totalUnits = plans.reduce((s, p) => s + p.capUnits, 0);

  // Random allocation: shuffle the canonical paths across voices per measure.
  const perMeasurePaths: Path[][] = plans.map(() => rng.shuffle(CANONICAL_PATHS));

  // Pitch reads the matrix by path; precompute one long stream per canonical path.
  const base = paletteCells(palette);
  const upperBound = totalUnits + 8; // at most one note per unit
  const pitchByPath = new Map<Path, number[]>();
  const allPaths = new Set<Path>(CANONICAL_PATHS);
  if (params.voiceAllocation.mode === 'manual') {
    for (const v of VOICES) allPaths.add(params.voiceAllocation.map[v]);
  }
  for (const p of allPaths) {
    pitchByPath.set(p, pitchStream(matrix, p, params.determinism, makeRng(params.seed ^ hashPath(p)), upperBound));
  }

  const pitchIdx = new Map<Path, number>();
  for (const p of allPaths) pitchIdx.set(p, 0);

  const voices: Record<VoiceId, NoteEvent[]> = {
    violinI: [],
    violinII: [],
    viola: [],
    cello: [],
  };

  for (const voice of VOICES) {
    const range = INSTRUMENT_RANGES[voice];
    let t = 0;
    let prev: number | null = null;
    let durIdx = 0; // duration cursor is per-voice
    while (t < totalUnits) {
      const m = measureIndexAt(plans, t);
      const path = pathForVoice(voice, m, params, perMeasurePaths);
      const pList = pitchByPath.get(path)!;

      const pi = pitchIdx.get(path)!;
      const pc = pList[pi % pList.length];
      pitchIdx.set(path, pi + 1);

      const dSeq = durationSequenceFor(base, params, path, voice);
      const dcell = dSeq[durIdx % dSeq.length];
      durIdx += 1;

      let dur = Math.max(1, dcell.mult);
      if (t + dur > totalUnits) dur = totalUnits - t; // clip final event

      let pitch: number | undefined;
      if (!dcell.silent) {
        let abs = placeOctave(pc, prev, range, params.dispersion);
        if (params.voiceLeading) abs = smoothLeap(abs, prev, range, params.dispersion);
        prev = abs;
        pitch = abs;
      }
      voices[voice].push({ startUnits: t, durUnits: dur, pitch, velocity: 0.8 });
      t += dur;
    }
  }

  const score: ScoreModel = {
    unit: palette.unit,
    tempoBpm: params.tempoBpm,
    voices,
    meters: plans.map((p) => p.meter),
  };

  applyStochasticRests(score, params.restProbability, params.minVoices, rng);

  return score;
}

function hashPath(p: Path): number {
  let h = 2166136261;
  for (let i = 0; i < p.length; i++) {
    h ^= p.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
