import { useMemo, useRef, useState } from 'react';
import type {
  DurationPalette,
  GenParams,
  NoteValue,
  Path,
  Series,
  VoiceId,
} from './types';
import { VALID_LENGTHS, VOICES } from './types';
import { randomize } from './core/series';
import { buildMatrix } from './core/matrix';
import { assemble } from './arranger/quartet';
import { toMusicXML } from './export/musicxml';
import { createPlayer } from './audio/scheduler';
import { makeRng } from './core/rng';
import { pcName, isQuarter } from './ui/format';

const PATHS: Path[] = ['P', 'R', 'I', 'RI', 'diagDown', 'diagUp'];
const UNITS: NoteValue[] = ['8n', '16n', '32n'];

function resize<T>(arr: T[], n: number, fill: T): T[] {
  if (arr.length === n) return arr;
  if (arr.length > n) return arr.slice(0, n);
  return [...arr, ...Array(n - arr.length).fill(fill)];
}

export function App() {
  const [series, setSeries] = useState<Series>({ length: 7, pitches: [0, 4, 3, 14, 9, 18, 11] });
  const [palette, setPalette] = useState<DurationPalette>({
    unit: '16n',
    multipliers: [1, 2, 3, 4, 5, 6, 7],
    silent: Array(7).fill(false),
  });
  const [semitonesOnly, setSemitonesOnly] = useState(false);
  const [seed, setSeed] = useState(1234);
  const [params, setParams] = useState<Omit<GenParams, 'seed'>>({
    matrixMode: 'schoenberg',
    durationMode: 'integral',
    strict: false,
    determinism: 1,
    restProbability: 0,
    minVoices: 1,
    dispersion: 0.3,
    voiceLeading: true,
    voiceAllocation: { mode: 'manual', map: { violinI: 'P', violinII: 'I', viola: 'R', cello: 'RI' } },
    tempoBpm: 120,
    meter: 'static',
    timeSignature: [4, 4],
    measureCount: 6,
  });

  const fullParams: GenParams = { ...params, seed };
  const matrix = useMemo(() => buildMatrix(series, params.matrixMode), [series, params.matrixMode]);
  const score = useMemo(() => assemble(matrix, palette, fullParams), [matrix, palette, fullParams]);

  const scoreRef = useRef(score);
  scoreRef.current = score;
  const playerRef = useRef(createPlayer(() => scoreRef.current));
  const [playing, setPlaying] = useState(false);

  const setLength = (n: number) => {
    setSeries((s) => ({ length: n, pitches: resize(s.pitches, n, 0) }));
    setPalette((p) => ({
      ...p,
      multipliers: resize(p.multipliers, n, 1).map((m, i) => (i >= p.multipliers.length ? i + 1 : m)),
      silent: resize(p.silent, n, false),
    }));
  };

  const randomizeSeries = () => {
    setSeries(randomize(series.length, { seed, semitonesOnly, strict: params.strict }));
  };

  const randomizePalette = () => {
    const rng = makeRng(seed ^ 0x9e3779b9);
    setPalette((p) => ({
      ...p,
      multipliers: p.multipliers.map(() => 1 + rng.int(series.length)),
    }));
  };

  const togglePlay = async () => {
    if (playerRef.current.isPlaying) {
      playerRef.current.stop();
      setPlaying(false);
    } else {
      await playerRef.current.play();
      setPlaying(true);
    }
  };

  const downloadXml = () => {
    const xml = toMusicXML(score);
    const blob = new Blob([xml], { type: 'application/vnd.recordare.musicxml+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'serial-quartet.musicxml';
    a.click();
    URL.revokeObjectURL(url);
  };

  const setPitch = (i: number, v: number) =>
    setSeries((s) => {
      const pitches = s.pitches.slice();
      pitches[i] = ((v % 24) + 24) % 24;
      return { ...s, pitches };
    });

  const up = <K extends keyof Omit<GenParams, 'seed'>>(k: K, v: Omit<GenParams, 'seed'>[K]) =>
    setParams((p) => ({ ...p, [k]: v }));

  return (
    <div className="app">
      <header>
        <h1>Post-Tonal Serial Workstation</h1>
        <div className="transport">
          <button className="primary" onClick={togglePlay}>
            {playing ? '■ Stop' : '▶ Play'}
          </button>
          <button onClick={downloadXml}>⭳ MusicXML</button>
        </div>
      </header>

      <div className="columns">
        <section className="panel">
          <h2>Series</h2>
          <div className="row">
            <label>Length N</label>
            <select value={series.length} onChange={(e) => setLength(Number(e.target.value))}>
              {VALID_LENGTHS.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div className="pitchgrid">
            {series.pitches.map((p, i) => (
              <div key={i} className={`pitchcell ${isQuarter(p) ? 'quarter' : ''}`}>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={p}
                  onChange={(e) => setPitch(i, Number(e.target.value))}
                />
                <span>{pcName(p)}</span>
              </div>
            ))}
          </div>
          <div className="row">
            <button onClick={randomizeSeries}>🎲 Randomize series</button>
            <label className="chk">
              <input type="checkbox" checked={semitonesOnly} onChange={(e) => setSemitonesOnly(e.target.checked)} />
              semitones only
            </label>
          </div>
          <div className="row">
            <label>Seed</label>
            <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} />
            <label className="chk">
              <input type="checkbox" checked={params.strict} onChange={(e) => up('strict', e.target.checked)} />
              strict (no repeats)
            </label>
          </div>
          <div className="row">
            <label>Matrix</label>
            <select value={params.matrixMode} onChange={(e) => up('matrixMode', e.target.value as GenParams['matrixMode'])}>
              <option value="schoenberg">Schoenberg (inversion)</option>
              <option value="stravinsky">Stravinsky (rotational)</option>
            </select>
          </div>
        </section>

        <section className="panel">
          <h2>Matrix</h2>
          <MatrixGrid matrix={matrix} />
          <p className="hint">
            {params.matrixMode === 'schoenberg'
              ? 'Rows = P, reversed = R; columns = I, reversed = RI.'
              : 'Rotational verticals — column reads are not inversions.'}
          </p>
        </section>

        <section className="panel">
          <h2>Rhythm & Generation</h2>
          <div className="row">
            <label>Atomic unit t₀</label>
            <select value={palette.unit} onChange={(e) => setPalette((p) => ({ ...p, unit: e.target.value as NoteValue }))}>
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            <button onClick={randomizePalette}>🎲 durations</button>
          </div>
          <div className="row">
            <label>Duration mode</label>
            <select value={params.durationMode} onChange={(e) => up('durationMode', e.target.value as GenParams['durationMode'])}>
              <option value="integral">Integral (Boulez)</option>
              <option value="independent">Independent</option>
            </select>
          </div>
          <Slider label="Determinism" value={params.determinism} onChange={(v) => up('determinism', v)} />
          <Slider label="Dispersion (jumpiness)" value={params.dispersion} onChange={(v) => up('dispersion', v)} />
          <Slider label="Rest probability" value={params.restProbability} onChange={(v) => up('restProbability', v)} />
          <div className="row">
            <label>Min voices</label>
            <select value={params.minVoices} onChange={(e) => up('minVoices', Number(e.target.value) as GenParams['minVoices'])}>
              {[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <label className="chk">
              <input type="checkbox" checked={params.voiceLeading} onChange={(e) => up('voiceLeading', e.target.checked)} />
              voice-leading
            </label>
          </div>
          <div className="row">
            <label>Meter</label>
            <select value={params.meter} onChange={(e) => up('meter', e.target.value as GenParams['meter'])}>
              <option value="static">Static 4/4</option>
              <option value="variable">Variable (from durations)</option>
            </select>
            <label>Measures</label>
            <input
              type="number" min={1} max={64} value={params.measureCount}
              onChange={(e) => up('measureCount', Number(e.target.value))}
            />
          </div>
          <div className="row">
            <label>Tempo {params.tempoBpm}</label>
            <input
              type="range" min={40} max={240} value={params.tempoBpm}
              onChange={(e) => up('tempoBpm', Number(e.target.value))}
            />
          </div>

          <h3>Voice allocation</h3>
          <div className="row">
            <label className="chk">
              <input
                type="radio" checked={params.voiceAllocation.mode === 'manual'}
                onChange={() => up('voiceAllocation', { mode: 'manual', map: { violinI: 'P', violinII: 'I', viola: 'R', cello: 'RI' } })}
              />
              manual
            </label>
            <label className="chk">
              <input
                type="radio" checked={params.voiceAllocation.mode === 'random'}
                onChange={() => up('voiceAllocation', { mode: 'random' })}
              />
              random (shifts per measure)
            </label>
          </div>
          {params.voiceAllocation.mode === 'manual' && (
            <div className="voicemap">
              {VOICES.map((v) => (
                <div key={v} className="row">
                  <label>{v}</label>
                  <select
                    value={(params.voiceAllocation as { mode: 'manual'; map: Record<VoiceId, Path> }).map[v]}
                    onChange={(e) => {
                      const alloc = params.voiceAllocation as { mode: 'manual'; map: Record<VoiceId, Path> };
                      up('voiceAllocation', { mode: 'manual', map: { ...alloc.map, [v]: e.target.value as Path } });
                    }}
                  >
                    {PATHS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="row">
      <label>{label} {(value * 100).toFixed(0)}%</label>
      <input type="range" min={0} max={1} step={0.01} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

function MatrixGrid({ matrix }: { matrix: ReturnType<typeof buildMatrix> }) {
  return (
    <div className="matrix" style={{ gridTemplateColumns: `repeat(${matrix.n}, 1fr)` }}>
      {matrix.cells.flatMap((row, y) =>
        row.map((pc, x) => (
          <div key={`${y}-${x}`} className={`mcell ${isQuarter(pc) ? 'quarter' : ''} ${x === y ? 'diag' : ''}`}>
            {pcName(pc)}
          </div>
        )),
      )}
    </div>
  );
}
