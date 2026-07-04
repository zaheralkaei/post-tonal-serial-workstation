// Lightweight auditioner for previewing a single matrix vector (a row, column,
// or diagonal). Plays the pitch classes in one fixed octave through the same
// bowed-string voice, firing a per-note callback so the UI can highlight cells.

import { freq, playString } from './synth';

const BASE_ABS = 4 * 24; // C4 in quarter-tone steps from C0
const STEP_SEC = 0.36; // time between note onsets
const NOTE_SEC = 0.32; // sounding length

export interface Auditioner {
  play(pitchClasses: number[], onStep: (i: number) => void, onDone: () => void): void;
  stop(): void;
}

type AudioCtor = typeof AudioContext;

export function createAuditioner(): Auditioner {
  let ctx: AudioContext | null = null;
  let timers: number[] = [];

  const clearTimers = () => {
    timers.forEach((t) => window.clearTimeout(t));
    timers = [];
  };

  const stop = () => {
    clearTimers();
    if (ctx) {
      ctx.close(); // cancels all scheduled notes
      ctx = null;
    }
  };

  const play = (pcs: number[], onStep: (i: number) => void, onDone: () => void) => {
    stop();
    const Ctor: AudioCtor =
      window.AudioContext || (window as unknown as { webkitAudioContext: AudioCtor }).webkitAudioContext;
    ctx = new Ctor();
    const master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);

    const start = ctx.currentTime + 0.05;
    pcs.forEach((pc, i) => {
      playString(ctx!, master, freq(BASE_ABS + pc), start + i * STEP_SEC, NOTE_SEC, 0.85);
      timers.push(window.setTimeout(() => onStep(i), (0.05 + i * STEP_SEC) * 1000));
    });
    timers.push(
      window.setTimeout(() => {
        onDone();
        stop();
      }, (0.05 + pcs.length * STEP_SEC) * 1000 + 60),
    );
  };

  return { play, stop };
}
