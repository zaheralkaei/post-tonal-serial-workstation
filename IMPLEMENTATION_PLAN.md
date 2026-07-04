# Implementation Plan: Post-Tonal Serial Workstation (Web / TypeScript)

Companion to [SPECIFICATION.md](SPECIFICATION.md) (Rev 4). Targets a browser app: a
framework-agnostic TypeScript **core engine**, a **Web Audio** synthesis layer for 24-EDO
playback, **MusicXML** export, and a **React** UI. The guiding principle is a pure, tested core
with all I/O (audio, DOM, files) at the edges.

## 1. Architecture Overview

```
┌───────────────────────────────────────────────────────────────────────┐
│  UI (React)   series input · Randomize · matrix view · transport · export│
└───────────────┬───────────────────────────────────────────────────────┘
                │ params + user series
┌───────────────▼───────────────┐   pure, deterministic, no I/O
│  Core Engine (TS)              │
│  pitch · series · rng · matrix │
│  traversal · duration          │
└───────────────┬───────────────┘
                │ ScoreModel (intermediate representation)
      ┌─────────┴─────────┐
┌─────▼─────┐       ┌──────▼───────┐
│ Audio     │       │ MusicXML     │   two consumers of ONE ScoreModel
│ (WebAudio)│       │ export       │
└───────────┘       └──────────────┘
```

**Key decoupling point — the `ScoreModel`.** The arranger produces a single intermediate
representation: four voices of timed note/rest events. Both the audio scheduler and the MusicXML
writer consume it, so playback and notation can never diverge.

## 2. Data Model (TypeScript)

```ts
// --- pitch space ---
type PitchClass = number;          // 0..23, mod-24
type AbsPitch  = number;           // register-resolved: quarter-tone steps from a fixed origin

// --- series ---
interface Series {
  length: number;                  // N ∈ {5,6,7,8,9,10,11,12,24}
  pitches: PitchClass[];           // length === N, each 0..23, repeats allowed
}

// --- matrix ---
type MatrixMode = 'schoenberg' | 'stravinsky';
interface Matrix {
  mode: MatrixMode;
  n: number;
  cells: PitchClass[][];           // cells[y][x], mod-24
  prime: PitchClass[];             // row 0
}

// --- duration ---
interface DurationPalette {
  unit: NoteValue;                 // t0, e.g. '16n' | '32n'
  multipliers: number[];           // length N, positive integers
  silent: boolean[];               // length N, structural rests
}
type DurationMode = 'integral' | 'independent';

// --- traversal ---
type Path = 'P' | 'R' | 'I' | 'RI' | 'diagDown' | 'diagUp';

// --- generation params ---
interface GenParams {
  strict: boolean;                 // §2.3 non-repetition
  scalarPreserving: false;         // removed in Rev 4 — always chromatic mod-24
  determinism: number;             // 0..1
  restProbability: number;         // 0..1
  minVoices: 0 | 1 | 2 | 3;        // default 1
  dispersion: number;              // D_reg 0..1
  voiceLeading: boolean;
  tempoBpm: number;                // 40..240
  meter: 'static' | 'variable';
  timeSignature?: [number, number];
  measureCount: number;
  seed?: number;
}

// --- intermediate representation (the contract) ---
interface NoteEvent {
  startUnits: number;              // onset in t0 units
  durUnits: number;
  pitch?: AbsPitch;                // undefined => rest
  velocity?: number;
}
interface ScoreModel {
  unit: NoteValue;
  tempoBpm: number;
  voices: [NoteEvent[], NoteEvent[], NoteEvent[], NoteEvent[]]; // VlnI, VlnII, Vla, Vc
  meters: [number, number][];      // per measure
}
```

## 3. Module Breakdown

All of `core/*` is pure and unit-tested; no `window`, `AudioContext`, or DOM.

| Module | Responsibility | Key functions |
|---|---|---|
| `core/pitch.ts` | mod-24 arithmetic | `mod24`, `invert(p, axis)`, `transpose(p, t)` |
| `core/rng.ts` | seeded PRNG (mulberry32) | `makeRng(seed)`, `int(max)`, `sample(arr, k, replace)` |
| `core/series.ts` | build / validate / randomize | `validate(series, strict)`, `randomize(n, {semitonesOnly, strict, seed})` |
| `core/matrix.ts` | matrix generators | `schoenberg(P0)`, `stravinsky(P)`, `inversionVector(P0)` |
| `core/traversal.ts` | read vectors from a matrix | `extract(matrix, path, index): PitchClass[]` |
| `core/duration.ts` | palette + permutation | `permuteByOrder(palette, order)`, `rotationalArray`, `retrograde`, `augment(factor)` |
| `arranger/register.ts` | PC → AbsPitch per voice | `placeOctave(pc, prev, range, dispersion)`, `INSTRUMENT_RANGES` |
| `arranger/extract.ts` | determinism axis | `strictQueue`, `hybridStep(d, rng)`, `randomWalk(rng)` |
| `arranger/rests.ts` | structural + stochastic rests | `applyRests(events, restProb, minVoices, rng)` |
| `arranger/quartet.ts` | assemble ScoreModel | `assemble(matrix, palette, params): ScoreModel` |
| `audio/scheduler.ts` | Web Audio playback | look-ahead scheduler over `ScoreModel` |
| `audio/synth.ts` | 24-EDO synthesis | `freq(absPitch) = 440*2^(k/24)`, per-voice oscillator+gain |
| `export/musicxml.ts` | notation export | `toMusicXML(score): string` with `<alter>`, `<rest>` |
| `ui/*` | React components | see §5 |

### Correctness invariants to encode as tests (`core/matrix.ts`)
- `schoenberg(P0).cells[0] === P0` (row 0 is the prime).
- Main diagonal is constant `= P0[0]`.
- Column `x` read top→bottom equals the inversion whose first element is `cells[0][x]`.
- `stravinsky(P).cells[0] === P`; every row starts on `P[0]`; row `k` is a transposed
  left-rotation by `k`.
- Golden test: a canonical 12-tone row (strict) reproduces its known 12×12 matrix.

## 4. Build Order (Milestones)

- **M1 — Core pitch structures.** `pitch`, `rng`, `series` (+Randomize), `matrix`, `traversal`.
  Verified by unit tests and a tiny console harness that prints a matrix. *No UI, no audio.*
- **M2 — Duration engine.** `duration` palette, integral coupling, independent rotational array,
  retrograde/augmentation, silent slots.
- **M3 — Arranger → ScoreModel.** `register` mapping (dispersion + ranges + voice-leading),
  `extract` (strict/hybrid/stochastic), `rests` (structural + probability + min-voices floor),
  `quartet.assemble`. Output validated as a data structure (durations sum correctly, ranges
  respected, seed reproducible).
- **M4 — Audio playback.** `synth` + `scheduler` consuming ScoreModel; look-ahead timer pattern
  (`currentTime` + 25 ms tick, 100 ms schedule-ahead window); 4 independent voices.
- **M5 — MusicXML export.** `toMusicXML`; validate round-trip by opening output in MuseScore.
- **M6 — React UI vertical slice.** Series input + Randomize, matrix grid, duration panel,
  generator controls, transport (play/stop), export button. Wire params → engine → ScoreModel →
  audio/export.

Each milestone is independently demoable; M1–M3 need no browser.

## 5. UI Components (React)

- `SeriesEditor` — N selector; per-note pitch input (Full-24-EDO or 12-Tone-Hybrid entry);
  **Randomize** button (seed field, semitones-only + strict toggles).
- `MatrixView` — N×N grid; mode switch (Schoenberg/Stravinsky); click a row/column/diagonal to
  select a traversal path; highlights the active vector.
- `DurationPanel` — palette editor, `t0` selector, silent-slot flags, duration mode, Randomize.
- `GeneratorControls` — determinism slider, rest probability, min-voices, dispersion,
  voice-leading toggle, tempo, meter mode, measure count.
- `Transport` — play/stop/loop, position readout.
- `ExportBar` — download MusicXML.

## 6. Key Technical Decisions

- **Microtonal audio is free in Web Audio.** `OscillatorNode.frequency` takes any Hz value, so
  24-EDO needs no special handling — set `440 * 2^(k/24)` directly. Start with a simple
  oscillator+ADSR per voice; a sampled/bowed-string timbre is a later polish, not a blocker.
- **Deterministic reproducibility.** One seeded PRNG threaded through Randomize *and* the
  stochastic arranger, so a `(params, seed)` pair always yields the identical piece.
- **Purity boundary.** Core + arranger are pure functions of `(Series, DurationPalette,
  GenParams)`; only `audio/*` and `export/*` touch host APIs. Enables fast unit tests and SSR-safe
  builds.
- **Single source of truth.** The `ScoreModel` IR is the only thing audio and notation read —
  never re-derive events in two places.
- **Suggested stack:** Vite + React + TypeScript, Vitest for tests, native Web Audio (no Tone.js
  required, though it's an option for scheduling if we want to move faster).

## 7. Open Items Before Coding

1. **Timbre target** for M4 — plain oscillator to start (recommended), or invest early in a
   string-like synth?
2. **Voice allocation policy** at 100% determinism — confirm the P→VlnI, I→VlnII, R→Vla,
   RI→Vc default mapping, and how paths cycle when `measureCount` exceeds available vectors.
3. **Variable-meter beaming/tie policy** for MusicXML — how to split a long `durUnits` across a
   barline (tie vs. clip). Default: tie across barlines.

None block M1–M2; they surface at M3–M5.
