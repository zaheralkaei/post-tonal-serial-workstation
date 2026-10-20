import { describe, it, expect } from 'vitest';
import { toMusicXML, notatableValues, splitDuration } from './musicxml';
import { assemble } from '../arranger/quartet';
import { buildMatrix } from '../core/matrix';
import { randomize } from '../core/series';
import type { DurationPalette, GenParams, NoteValue } from '../types';

const UNIT_DEN: Record<NoteValue, number> = { '4n': 4, '8n': 8, '16n': 16, '32n': 32 };
const TYPE_QUARTERS: Record<string, number> = {
  whole: 4, half: 2, quarter: 1, eighth: 0.5, '16th': 0.25, '32nd': 0.125,
};

function params(over: Partial<GenParams> = {}): GenParams {
  return {
    matrixMode: 'schoenberg', durationMode: 'integral', strict: false, determinism: 1,
    restProbability: 0.2, minVoices: 1, dispersion: 0.3, voiceLeading: true,
    voiceAllocation: { mode: 'manual', map: { violinI: 'P', violinII: 'I', viola: 'R', cello: 'RI' } },
    durationTransforms: {
      violinI: { reverse: false, rotate: 0 }, violinII: { reverse: false, rotate: 0 },
      viola: { reverse: false, rotate: 0 }, cello: { reverse: true, rotate: 0 },
    },
    tempoBpm: 120, meter: 'static', timeSignature: [4, 4], measureCount: 6, seed: 9,
    ...over,
  };
}

describe('splitDuration', () => {
  const v = notatableValues(4); // 16th = 1 division
  const show = (d: number) => splitDuration(d, v).map((x) => `${x.type}${x.dots ? '.' : ''}`);

  it('uses single symbols where one exists', () => {
    expect(show(3)).toEqual(['eighth.']);
    expect(show(6)).toEqual(['quarter.']);
    expect(show(12)).toEqual(['half.']);
  });

  it('ties values that have no single symbol', () => {
    expect(show(5)).toEqual(['quarter', '16th']);
    expect(show(7)).toEqual(['quarter.', '16th']);
  });
});

describe('MusicXML rhythm notation', () => {
  const cases: [string, DurationPalette, Partial<GenParams>][] = [
    ['16n static', { unit: '16n', multipliers: [1, 2, 3, 4, 5, 6, 7], silent: [false, false, true, false, false, false, false] }, {}],
    ['16n variable', { unit: '16n', multipliers: [3, 5, 7, 2, 9, 11, 13], silent: Array(7).fill(false) }, { meter: 'variable' }],
    ['8n static', { unit: '8n', multipliers: [1, 3, 5, 7, 2, 6, 4], silent: Array(7).fill(false) }, {}],
    ['32n static', { unit: '32n', multipliers: [5, 7, 9, 11, 13, 3, 1], silent: Array(7).fill(false) }, {}],
  ];

  for (const [name, palette, over] of cases) {
    it(`${name}: every written value matches its duration and measures add up`, () => {
      const score = assemble(buildMatrix(randomize(7, { seed: 4 }), 'schoenberg'), palette, params(over));
      const xml = toMusicXML(score);
      const divPerQuarter = Math.max(1, UNIT_DEN[palette.unit] / 4);

      const parts = [...xml.matchAll(/<part id="P\d">([\s\S]*?)<\/part>/g)].map((m) => m[1]);
      expect(parts).toHaveLength(4);
      for (const part of parts) {
        const measures = [...part.matchAll(/<measure number="(\d+)">([\s\S]*?)<\/measure>/g)];
        measures.forEach((mm, i) => {
          let sum = 0;
          for (const [, note] of mm[2].matchAll(/<note>([\s\S]*?)<\/note>/g)) {
            const dur = Number(/<duration>(\d+)<\/duration>/.exec(note)![1]);
            const type = /<type>(\w+)<\/type>/.exec(note)![1];
            const dotted = note.includes('<dot/>');
            const written = TYPE_QUARTERS[type] * divPerQuarter * (dotted ? 1.5 : 1);
            expect(written).toBe(dur);
            sum += dur;
          }
          const [num, den] = score.meters[i];
          expect(sum).toBe((num * UNIT_DEN[palette.unit]) / den);
        });
      }
    });
  }
});
