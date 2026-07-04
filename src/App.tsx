import { Fragment, useMemo, useRef, useState } from 'react';
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
import { createAuditioner } from './audio/audition';
import { makeRng } from './core/rng';
import { pcName, isQuarter } from './ui/format';
import { SheetMusic } from './ui/SheetMusic';

const PATHS: Path[] = ['P', 'R', 'I', 'RI', 'diagDown', 'diagUp'];
const UNITS: NoteValue[] = ['8n', '16n', '32n'];

function resize<T>(arr: T[], n: number, fill: T): T[] {
  if (arr.length === n) return arr;
  if (arr.length > n) return arr.slice(0, n);
  return [...arr, ...Array(n - arr.length).fill(fill)];
}

interface Composition {
  matrix: ReturnType<typeof buildMatrix>;
  score: ReturnType<typeof assemble>;
  xml: string;
  sig: string;
}

/** Build a full composition snapshot from the current inputs. */
function generate(series: Series, palette: DurationPalette, fullParams: GenParams): Composition {
  const matrix = buildMatrix(series, fullParams.matrixMode);
  const score = assemble(matrix, palette, fullParams);
  const xml = toMusicXML(score);
  return { matrix, score, xml, sig: JSON.stringify({ series, palette, fullParams }) };
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
    durationTransforms: {
      violinI: { reverse: false, rotate: 0 },
      violinII: { reverse: false, rotate: 0 },
      viola: { reverse: false, rotate: 0 },
      cello: { reverse: true, rotate: 0 },
    },
    tempoBpm: 120,
    meter: 'static',
    timeSignature: [4, 4],
    measureCount: 6,
  });

  const fullParams: GenParams = { ...params, seed };

  // The active composition is committed explicitly via Generate — it does not
  // recompute live as you edit, so playback and notation stay stable until asked.
  const [comp, setComp] = useState(() => generate(series, palette, fullParams));
  const signature = JSON.stringify({ series, palette, fullParams });
  const dirty = signature !== comp.sig;

  const doGenerate = () => setComp(generate(series, palette, fullParams));

  // The matrix is a direct view of the series, so it updates live as you edit;
  // only the rendered composition (score / sheet / audio) waits for Generate.
  const liveMatrix = useMemo(
    () => buildMatrix(series, params.matrixMode),
    [series, params.matrixMode],
  );

  const scoreRef = useRef(comp.score);
  scoreRef.current = comp.score;
  const [playing, setPlaying] = useState(false);
  const playerRef = useRef<ReturnType<typeof createPlayer>>();
  if (!playerRef.current) playerRef.current = createPlayer(() => scoreRef.current, setPlaying);
  const auditionRef = useRef<ReturnType<typeof createAuditioner>>();
  if (!auditionRef.current) auditionRef.current = createAuditioner();

  const [showAbout, setShowAbout] = useState(false);

  // Audition state: which vector is sounding, and which cell is lit right now.
  const [auditionId, setAuditionId] = useState<string | null>(null);
  const [activeCell, setActiveCell] = useState<{ y: number; x: number } | null>(null);

  const audition = (id: string, pcs: number[], coords: (i: number) => [number, number]) => {
    if (auditionId === id) {
      auditionRef.current!.stop();
      setAuditionId(null);
      setActiveCell(null);
      return;
    }
    setAuditionId(id);
    auditionRef.current!.play(
      pcs,
      (i) => {
        const [y, x] = coords(i);
        setActiveCell({ y, x });
      },
      () => {
        setAuditionId(null);
        setActiveCell(null);
      },
    );
  };

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
    const player = playerRef.current!;
    // React `playing` mirrors the player via the onPlayingChange callback, so it
    // stays correct on manual stop AND when the piece ends on its own.
    if (player.isPlaying) player.stop();
    else await player.play();
  };

  const downloadXml = () => {
    const blob = new Blob([comp.xml], { type: 'application/vnd.recordare.musicxml+xml' });
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

  const setMultiplier = (i: number, v: number) =>
    setPalette((p) => {
      const multipliers = p.multipliers.slice();
      multipliers[i] = Math.max(1, Math.min(99, Math.round(v) || 1));
      return { ...p, multipliers };
    });

  const toggleSilent = (i: number) =>
    setPalette((p) => {
      const silent = p.silent.slice();
      silent[i] = !silent[i];
      return { ...p, silent };
    });

  const setTransform = (v: VoiceId, patch: Partial<{ reverse: boolean; rotate: number }>) =>
    setParams((p) => ({
      ...p,
      durationTransforms: {
        ...p.durationTransforms,
        [v]: { ...p.durationTransforms[v], ...patch },
      },
    }));

  const up = <K extends keyof Omit<GenParams, 'seed'>>(k: K, v: Omit<GenParams, 'seed'>[K]) =>
    setParams((p) => ({ ...p, [k]: v }));

  return (
    <div className="app">
      <header>
        <div className="titlewrap">
          <h1>Post-Tonal Serial Workstation</h1>
          <button className="infobtn" title="About this app" onClick={() => setShowAbout(true)}>ⓘ</button>
        </div>
      </header>

      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}

      <div className="columns">
        <div className="col-left">
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
          <MatrixGrid matrix={liveMatrix} active={activeCell} playingId={auditionId} onAudition={audition} />
          <p className="hint">
            Updates live as you edit the series. ▸ audition a row (P), ▾ a column (I), or a
            diagonal — the sounding note lights up.
            {params.matrixMode === 'schoenberg'
              ? ' Rows are prime forms; columns are inversions.'
              : ' Stravinsky mode: columns are rotational verticals, not inversions.'}
            {dirty && ' · Press Generate to update the score & audio.'}
          </p>
        </section>
        </div>

        <div className="col-right">
        <section className="panel">
          <h2>Rhythm & Generation</h2>
          <div className="row">
            <label>Atomic unit t₀</label>
            <select value={palette.unit} onChange={(e) => setPalette((p) => ({ ...p, unit: e.target.value as NoteValue }))}>
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            <button
              onClick={randomizePalette}
              title="Replace every duration value with a random length from 1 to N × t₀ (rests and unit unchanged)"
            >
              🎲 Randomize durations
            </button>
          </div>
          <label className="fieldlabel">
            Duration series — read left→right; each cell is note <em>k</em>'s length in {palette.unit} units.
            Bar shows relative length; ♪ = note, click to make it a rest (𝄽).
          </label>
          <div className="durgrid">
            {palette.multipliers.map((mult, i) => {
              const maxMult = Math.max(...palette.multipliers, 1);
              return (
                <div key={i} className={`durcell ${palette.silent[i] ? 'rest' : ''}`}>
                  <span className="duridx">{i + 1}</span>
                  <input
                    type="number" min={1} max={99} value={mult}
                    onChange={(e) => setMultiplier(i, Number(e.target.value))}
                  />
                  <div className="durbar" title={`${mult} × ${palette.unit}`}>
                    <div className="durbarfill" style={{ height: `${(mult / maxMult) * 100}%` }} />
                  </div>
                  <button className="silentbtn" title="toggle rest" onClick={() => toggleSilent(i)}>
                    {palette.silent[i] ? '𝄽' : '♪'}
                  </button>
                </div>
              );
            })}
          </div>
          <p className="durseq">
            series:{' '}
            {palette.multipliers
              .map((m, i) => (palette.silent[i] ? `(${m})` : `${m}`))
              .join(' – ')}
            {'  '}<span className="durseqnote">( ) = rest</span>
          </p>
          <div className="row">
            <label>Duration mode</label>
            <select value={params.durationMode} onChange={(e) => up('durationMode', e.target.value as GenParams['durationMode'])}>
              <option value="integral">Integral (Boulez — follows pitch)</option>
              <option value="independent">Independent (per-voice)</option>
            </select>
          </div>
          {params.durationMode === 'independent' && (
            <div className="transforms">
              <label className="fieldlabel">Per-voice rhythm — direction &amp; rotation</label>
              {VOICES.map((v) => {
                const tf = params.durationTransforms[v];
                return (
                  <div key={v} className="row">
                    <label>{v}</label>
                    <select
                      value={tf.reverse ? 'reverse' : 'forward'}
                      onChange={(e) => setTransform(v, { reverse: e.target.value === 'reverse' })}
                    >
                      <option value="forward">forward</option>
                      <option value="reverse">reverse</option>
                    </select>
                    <label>rotate</label>
                    <input
                      type="number" min={0} max={series.length - 1} value={tf.rotate}
                      onChange={(e) => setTransform(v, { rotate: Math.max(0, Number(e.target.value) || 0) })}
                    />
                  </div>
                );
              })}
            </div>
          )}
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
            <span className="field">
              <label>Meter</label>
              <select value={params.meter} onChange={(e) => up('meter', e.target.value as GenParams['meter'])}>
                <option value="static">Static 4/4</option>
                <option value="variable">Variable (from durations)</option>
              </select>
            </span>
            <span className="field">
              <label>Measures</label>
              <input
                type="number" min={1} max={64} value={params.measureCount}
                onChange={(e) => up('measureCount', Number(e.target.value))}
              />
            </span>
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

      <div className="actionbar">
        <button className={`primary ${dirty ? 'dirty' : ''}`} onClick={doGenerate}>
          ⟳ Generate{dirty ? ' •' : ''}
        </button>
        <button onClick={togglePlay}>{playing ? '■ Stop' : '▶ Play'}</button>
        <button onClick={downloadXml}>⭳ MusicXML</button>
      </div>

      <section className="panel scorepanel">
        <h2>Score</h2>
        <SheetMusic xml={comp.xml} />
        <p className="hint">
          Engraved from the same MusicXML the ⭳ button exports (rendered in-browser via
          OpenSheetMusicDisplay). Quarter-tones use microtonal accidentals.
        </p>
      </section>
    </div>
  );
}

function AboutModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} title="Close">✕</button>
        <h2>About</h2>
        <p>
          The <strong>Post-Tonal Serial Workstation</strong> is an environment for analysing,
          generating, and algorithmically composing serial music. It unifies four avant-garde
          traditions that were historically kept apart:
        </p>
        <ul>
          <li><strong>Schoenberg</strong> — classical twelve-tone matrices (Prime, Inversion, Retrograde, Retrograde-Inversion), generalised to any series length.</li>
          <li><strong>Stravinsky</strong> — rotational arrays, where each rotation is transposed back to the starting pitch and harmony is drawn from the verticals.</li>
          <li><strong>Boulez</strong> — integral (total) serialism: rhythm serialised as a duration palette whose deployment order is permuted alongside the pitches.</li>
          <li><strong>Wyschnegradsky</strong> — full 24-tone quarter-tone microtonality (24-EDO).</li>
        </ul>
        <p>
          A series is any number of pitches (5–12 or 24) drawn from the 24-EDO space; the engine
          builds a matrix, couples it to a duration series, and arranges the result for a string
          quartet — which you can <strong>audition per row/column/diagonal</strong>, play back with
          a bowed-string synth, engrave as notation, and export as MusicXML.
        </p>
        <p className="credit">
          Conceptualized and implemented by{' '}
          <a href="https://github.com/zaheralkaei" target="_blank" rel="noopener noreferrer">
            <strong>Zaher Alkaei</strong>
          </a>
          .
        </p>
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

interface MatrixGridProps {
  matrix: ReturnType<typeof buildMatrix>;
  active: { y: number; x: number } | null;
  playingId: string | null;
  onAudition: (id: string, pcs: number[], coords: (i: number) => [number, number]) => void;
}

function MatrixGrid({ matrix, active, playingId, onAudition }: MatrixGridProps) {
  const n = matrix.n;
  const column = (x: number) => matrix.cells.map((r) => r[x]);
  const diagDown = matrix.cells.map((r, i) => r[i]);
  const diagUp = matrix.cells.map((r, i) => r[n - 1 - i]);

  return (
    <div className="matrixblock">
      <div className="matrixgrid" style={{ gridTemplateColumns: `1.3rem repeat(${n}, 1fr)` }}>
        <div className="corner" />
        {Array.from({ length: n }, (_, x) => (
          <button
            key={`col-${x}`}
            className={`mbtn ${playingId === `col-${x}` ? 'on' : ''}`}
            title={`Audition column ${x + 1} (I)`}
            onClick={() => onAudition(`col-${x}`, column(x), (i) => [i, x])}
          >
            {playingId === `col-${x}` ? '■' : '▾'}
          </button>
        ))}
        {matrix.cells.map((row, y) => (
          <Fragment key={`row-${y}`}>
            <button
              className={`mbtn ${playingId === `row-${y}` ? 'on' : ''}`}
              title={`Audition row ${y + 1} (P)`}
              onClick={() => onAudition(`row-${y}`, row, (i) => [y, i])}
            >
              {playingId === `row-${y}` ? '■' : '▸'}
            </button>
            {row.map((pc, x) => (
              <div
                key={x}
                className={`mcell ${isQuarter(pc) ? 'quarter' : ''} ${x === y ? 'diag' : ''} ${
                  active && active.y === y && active.x === x ? 'active' : ''
                }`}
              >
                {pcName(pc)}
              </div>
            ))}
          </Fragment>
        ))}
      </div>
      <div className="diagrow">
        <button
          className={`mbtn wide ${playingId === 'diagDown' ? 'on' : ''}`}
          onClick={() => onAudition('diagDown', diagDown, (i) => [i, i])}
        >
          {playingId === 'diagDown' ? '■' : '↘'} diagonal
        </button>
        <button
          className={`mbtn wide ${playingId === 'diagUp' ? 'on' : ''}`}
          onClick={() => onAudition('diagUp', diagUp, (i) => [i, n - 1 - i])}
        >
          {playingId === 'diagUp' ? '■' : '↗'} diagonal
        </button>
      </div>
    </div>
  );
}
