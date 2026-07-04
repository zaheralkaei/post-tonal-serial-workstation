# Post-Tonal Serial Workstation

A browser-based environment for analyzing, generating, and algorithmically composing
serial music — unifying Schoenbergian dodecaphony, Stravinskyan rotational arrays,
Boulezian integral serialism, and Wyschnegradsky 24-EDO quarter-tone microtonality —
targeting an acoustic string quartet.

- Design: [SPECIFICATION.md](SPECIFICATION.md) (Rev 4)
- Build plan: [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)

## Stack

Vite + React + TypeScript, native Web Audio (24-EDO synthesis), MusicXML export.
Fully client-side — deploys to Netlify with no backend (see `netlify.toml`).

## Develop

```bash
npm install
npm run dev        # local dev server
npm test           # engine unit tests (Vitest)
npm run build      # production build to dist/ (what Netlify publishes)
```

## Architecture

A pure, tested **core engine** feeds a single intermediate representation
(`ScoreModel`) that both the audio scheduler and the MusicXML exporter consume, so
playback and notation never diverge.

```
src/
  core/       pitch (mod-24), rng (seeded), series, matrix, traversal, duration
  arranger/   register mapping, determinism extraction, rests, quartet -> ScoreModel
  audio/      bowed-string synth + look-ahead scheduler
  export/     MusicXML (quarter-tones via <alter>, ties across barlines)
  ui/         React components
```

All pitch arithmetic is absolute 24-EDO (mod 24); a series is simply *N* pitch classes
(any of `0..23`, quarter-tones included), where *N* ∈ {5,6,7,8,9,10,11,12,24}.
