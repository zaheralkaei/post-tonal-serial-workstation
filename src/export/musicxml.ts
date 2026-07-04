// MusicXML export (§4.5). Quarter-tones via <alter> (±0.5); long durations are
// split at barlines and tied. Temporally exact; <type> is best-effort notation.

import type { AbsPitch, NoteValue, ScoreModel, VoiceId } from '../types';
import { VOICES } from '../types';

const UNIT_DEN: Record<NoteValue, number> = { '4n': 4, '8n': 8, '16n': 16, '32n': 32 };

const VOICE_META: Record<VoiceId, { id: string; name: string; clef: [string, number] }> = {
  violinI: { id: 'P1', name: 'Violin I', clef: ['G', 2] },
  violinII: { id: 'P2', name: 'Violin II', clef: ['G', 2] },
  viola: { id: 'P3', name: 'Viola', clef: ['C', 3] },
  cello: { id: 'P4', name: 'Cello', clef: ['F', 4] },
};

// Sharp spelling for the 12 semitone classes.
const SPELL: [string, number][] = [
  ['C', 0], ['C', 1], ['D', 0], ['D', 1], ['E', 0], ['F', 0],
  ['F', 1], ['G', 0], ['G', 1], ['A', 0], ['A', 1], ['B', 0],
];

function absToPitch(abs: AbsPitch): { step: string; alter: number; octave: number } {
  const semitoneFloat = abs / 2; // quarter-tone steps -> semitones (may end in .5)
  const intSemi = Math.floor(semitoneFloat);
  const frac = semitoneFloat - intSemi; // 0 or 0.5
  const pc = ((intSemi % 12) + 12) % 12;
  const octave = Math.floor(intSemi / 12);
  const [step, alter] = SPELL[pc];
  return { step, alter: alter + frac, octave };
}

// MusicXML accidental glyph names, including quarter-tone microtones.
function accidentalName(alter: number): string | null {
  switch (alter) {
    case 0.5: return 'quarter-sharp';
    case 1: return 'sharp';
    case 1.5: return 'three-quarters-sharp';
    case 2: return 'double-sharp';
    case -0.5: return 'quarter-flat';
    case -1: return 'flat';
    case -1.5: return 'three-quarters-flat';
    default: return null; // 0 => natural, not printed
  }
}

function noteType(durDiv: number, divPerQuarter: number): string {
  const q = durDiv / divPerQuarter;
  if (q >= 4) return 'whole';
  if (q >= 2) return 'half';
  if (q >= 1) return 'quarter';
  if (q >= 0.5) return 'eighth';
  if (q >= 0.25) return '16th';
  return '32nd';
}

interface Seg {
  measure: number;
  dur: number; // divisions
  pitch?: AbsPitch;
  tieStart: boolean;
  tieStop: boolean;
}

export function toMusicXML(score: ScoreModel): string {
  const unitDen = UNIT_DEN[score.unit];
  const divPerQuarter = Math.max(1, unitDen / 4); // 1 t0 unit === 1 division
  const capOf = (m: [number, number]) => Math.round((m[0] * unitDen) / m[1]);

  const boundaries: number[] = [];
  let acc = 0;
  for (const m of score.meters) {
    acc += capOf(m);
    boundaries.push(acc);
  }
  const measureOf = (pos: number): number => {
    for (let i = 0; i < boundaries.length; i++) if (pos < boundaries[i]) return i;
    return boundaries.length - 1;
  };

  const segmentVoice = (voice: VoiceId): Seg[][] => {
    const perMeasure: Seg[][] = score.meters.map(() => []);
    for (const e of score.voices[voice]) {
      let cs = e.startUnits;
      const total = e.startUnits + e.durUnits;
      while (cs < total) {
        const m = measureOf(cs);
        const measureEnd = boundaries[m];
        const take = Math.min(total - cs, measureEnd - cs);
        perMeasure[m].push({
          measure: m,
          dur: take,
          pitch: e.pitch,
          tieStart: cs + take < total && e.pitch !== undefined,
          tieStop: cs > e.startUnits && e.pitch !== undefined,
        });
        cs += take;
      }
    }
    return perMeasure;
  };

  const renderNote = (seg: Seg): string => {
    const tieEls: string[] = [];
    const tiedEls: string[] = [];
    if (seg.tieStop) {
      tieEls.push('<tie type="stop"/>');
      tiedEls.push('<tied type="stop"/>');
    }
    if (seg.tieStart) {
      tieEls.push('<tie type="start"/>');
      tiedEls.push('<tied type="start"/>');
    }
    const type = noteType(seg.dur, divPerQuarter);
    if (seg.pitch === undefined) {
      return (
        `        <note>\n          <rest/>\n          <duration>${seg.dur}</duration>\n` +
        `          <voice>1</voice>\n          <type>${type}</type>\n        </note>`
      );
    }
    const { step, alter, octave } = absToPitch(seg.pitch);
    const alterEl = alter !== 0 ? `\n            <alter>${alter}</alter>` : '';
    const acc = accidentalName(alter);
    // Suppress the accidental on the tail of a tie (it's already shown on the start).
    const accEl = acc && !seg.tieStop ? `\n          <accidental>${acc}</accidental>` : '';
    const notations = tiedEls.length ? `\n          <notations>${tiedEls.join('')}</notations>` : '';
    return (
      `        <note>\n` +
      `          <pitch>\n            <step>${step}</step>${alterEl}\n            <octave>${octave}</octave>\n          </pitch>\n` +
      `          <duration>${seg.dur}</duration>\n` +
      tieEls.map((t) => `          ${t}\n`).join('') +
      `          <voice>1</voice>\n` +
      `          <type>${type}</type>${accEl}${notations}\n` +
      `        </note>`
    );
  };

  const renderPart = (voice: VoiceId): string => {
    const meta = VOICE_META[voice];
    const perMeasure = segmentVoice(voice);
    const measures = score.meters
      .map((meter, m) => {
        const attrs =
          m === 0
            ? `      <attributes>\n        <divisions>${divPerQuarter}</divisions>\n` +
              `        <key><fifths>0</fifths></key>\n` +
              `        <time><beats>${meter[0]}</beats><beat-type>${meter[1]}</beat-type></time>\n` +
              `        <clef><sign>${meta.clef[0]}</sign><line>${meta.clef[1]}</line></clef>\n` +
              `      </attributes>\n`
            : timeChanged(score.meters, m)
              ? `      <attributes>\n        <time><beats>${meter[0]}</beats><beat-type>${meter[1]}</beat-type></time>\n      </attributes>\n`
              : '';
        const notes = perMeasure[m].map(renderNote).join('\n');
        return `    <measure number="${m + 1}">\n${attrs}${notes}\n    </measure>`;
      })
      .join('\n');
    return `  <part id="${meta.id}">\n${measures}\n  </part>`;
  };

  const partList = VOICES.map((v) => {
    const meta = VOICE_META[v];
    return `    <score-part id="${meta.id}">\n      <part-name>${meta.name}</part-name>\n    </score-part>`;
  }).join('\n');

  const parts = VOICES.map(renderPart).join('\n');

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">\n` +
    `<score-partwise version="4.0">\n` +
    `  <part-list>\n${partList}\n  </part-list>\n` +
    `${parts}\n` +
    `</score-partwise>\n`
  );
}

function timeChanged(meters: [number, number][], m: number): boolean {
  return m > 0 && (meters[m][0] !== meters[m - 1][0] || meters[m][1] !== meters[m - 1][1]);
}
