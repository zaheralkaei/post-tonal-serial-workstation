// Stochastic density thinning (§4.4). Structural rests already come from silent
// duration cells during assembly; this pass adds probabilistic rests while
// respecting a minimum-sounding-voices floor per vertical attack.

import type { ScoreModel, VoiceId } from '../types';
import { VOICES } from '../types';
import type { Rng } from '../core/rng';

interface Tagged {
  voice: VoiceId;
  idx: number;
  start: number;
}

/** How many voices OTHER than `exclude` are sounding at `time`. */
function soundingOtherVoices(score: ScoreModel, time: number, exclude: VoiceId): number {
  let count = 0;
  for (const v of VOICES) {
    if (v === exclude) continue;
    for (const e of score.voices[v]) {
      if (e.pitch === undefined) continue;
      if (time >= e.startUnits && time < e.startUnits + e.durUnits) {
        count++;
        break;
      }
    }
  }
  return count;
}

export function applyStochasticRests(
  score: ScoreModel,
  restProbability: number,
  minVoices: number,
  rng: Rng,
): void {
  if (restProbability <= 0) return;

  const all: Tagged[] = [];
  for (const v of VOICES) {
    score.voices[v].forEach((e, idx) => {
      if (e.pitch !== undefined) all.push({ voice: v, idx, start: e.startUnits });
    });
  }

  for (const t of rng.shuffle(all)) {
    if (rng.next() >= restProbability) continue;
    // Resting this event leaves `soundingOtherVoices` sounding at t.start.
    if (soundingOtherVoices(score, t.start, t.voice) >= minVoices) {
      score.voices[t.voice][t.idx].pitch = undefined;
    }
  }
}
