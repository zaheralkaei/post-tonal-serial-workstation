import { describe, it, expect } from 'vitest';
import { assemble } from './quartet';
import { buildMatrix } from '../core/matrix';
import { INSTRUMENT_RANGES } from './register';
import { toMusicXML } from '../export/musicxml';
import { VOICES } from '../types';
import type { DurationPalette, GenParams, Series } from '../types';

const series: Series = { length: 7, pitches: [0, 4, 3, 14, 9, 18, 11] };
const palette: DurationPalette = {
  unit: '16n',
  multipliers: [1, 2, 3, 4, 5, 6, 7],
  silent: [false, false, false, false, false, false, false],
};

function params(over: Partial<GenParams> = {}): GenParams {
  return {
    matrixMode: 'schoenberg',
    durationMode: 'integral',
    strict: false,
    determinism: 1,
    restProbability: 0,
    minVoices: 1,
    dispersion: 0.3,
    voiceLeading: true,
    voiceAllocation: {
      mode: 'manual',
      map: { violinI: 'P', violinII: 'I', viola: 'R', cello: 'RI' },
    },
    durationTransforms: {
      violinI: { reverse: false, rotate: 0 },
      violinII: { reverse: false, rotate: 0 },
      viola: { reverse: false, rotate: 0 },
      cello: { reverse: true, rotate: 0 },
    },
    tempoBpm: 120,
    meter: 'static',
    timeSignature: [4, 4],
    measureCount: 4,
    seed: 123,
    ...over,
  };
}

describe('quartet assembler', () => {
  it('every voice exactly fills the total timeline', () => {
    const m = buildMatrix(series, 'schoenberg');
    const score = assemble(m, palette, params());
    const totalUnits = score.meters.reduce((s, mt) => s + (mt[0] * 16) / mt[1], 0);
    for (const v of VOICES) {
      const evs = score.voices[v];
      expect(evs[0].startUnits).toBe(0);
      const end = evs[evs.length - 1].startUnits + evs[evs.length - 1].durUnits;
      expect(end).toBe(totalUnits);
      // contiguous, no gaps or overlaps
      for (let i = 1; i < evs.length; i++) {
        expect(evs[i].startUnits).toBe(evs[i - 1].startUnits + evs[i - 1].durUnits);
      }
    }
  });

  it('sounding pitches stay within each instrument absolute range', () => {
    const m = buildMatrix(series, 'schoenberg');
    const score = assemble(m, palette, params({ dispersion: 1 }));
    for (const v of VOICES) {
      const r = INSTRUMENT_RANGES[v];
      for (const e of score.voices[v]) {
        if (e.pitch !== undefined) {
          expect(e.pitch).toBeGreaterThanOrEqual(r.absLo);
          expect(e.pitch).toBeLessThanOrEqual(r.absHi);
        }
      }
    }
  });

  it('is reproducible for a fixed seed', () => {
    const m = buildMatrix(series, 'stravinsky');
    const a = assemble(m, palette, params({ matrixMode: 'stravinsky', determinism: 0.4 }));
    const b = assemble(m, palette, params({ matrixMode: 'stravinsky', determinism: 0.4 }));
    expect(a.voices).toEqual(b.voices);
  });

  it('random voice allocation produces a valid score', () => {
    const m = buildMatrix(series, 'schoenberg');
    const score = assemble(m, palette, params({ voiceAllocation: { mode: 'random' } }));
    expect(score.voices.violinI.length).toBeGreaterThan(0);
  });

  it('exports non-empty MusicXML', () => {
    const m = buildMatrix(series, 'schoenberg');
    const score = assemble(m, palette, params({ meter: 'variable' }));
    const xml = toMusicXML(score);
    expect(xml).toContain('<score-partwise');
    expect(xml).toContain('<part id="P1">');
    expect(xml.split('<measure').length - 1).toBe(4 * 4); // 4 measures × 4 parts
  });

  it('independent mode: a reversed voice gets different durations than a forward one', () => {
    const m = buildMatrix(series, 'schoenberg');
    const score = assemble(
      m,
      palette,
      params({
        durationMode: 'independent',
        // Violin I forward, Cello reversed — same allocation so pitch paths differ only.
        durationTransforms: {
          violinI: { reverse: false, rotate: 0 },
          violinII: { reverse: false, rotate: 0 },
          viola: { reverse: false, rotate: 0 },
          cello: { reverse: true, rotate: 0 },
        },
      }),
    );
    const vDur = score.voices.violinI.slice(0, 7).map((e) => e.durUnits);
    const cDur = score.voices.cello.slice(0, 7).map((e) => e.durUnits);
    // palette 1..7 forward vs reversed 7..1 -> sequences must differ.
    expect(vDur).not.toEqual(cDur);
    expect(cDur[0]).toBe(7);
  });

  it('emits quarter-tone accidentals for microtonal pitches', () => {
    // series includes pitch class 3 (a quarter-tone), so the score must too.
    const m = buildMatrix(series, 'schoenberg');
    const score = assemble(m, palette, params({ dispersion: 0 }));
    const xml = toMusicXML(score);
    expect(xml).toContain('<alter>0.5</alter>');
    expect(xml).toContain('<accidental>quarter-sharp</accidental>');
  });
});
