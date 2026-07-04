// Look-ahead scheduler (Chris Wilson pattern) that plays a ScoreModel through
// the bowed-string voice. All four voices share one AudioContext timeline.

import type { NoteValue, ScoreModel, VoiceId } from '../types';
import { VOICES } from '../types';
import { freq, playString } from './synth';

const UNIT_WHOLE: Record<NoteValue, number> = {
  '4n': 1 / 4,
  '8n': 1 / 8,
  '16n': 1 / 16,
  '32n': 1 / 32,
};

/** Seconds per t0 unit at the score's tempo. */
function secondsPerUnit(score: ScoreModel): number {
  const secondsPerWhole = (60 / score.tempoBpm) * 4; // quarter = 60/bpm
  return UNIT_WHOLE[score.unit] * secondsPerWhole;
}

export interface Player {
  play(): Promise<void>;
  stop(): void;
  readonly isPlaying: boolean;
}

interface FlatEvent {
  voice: VoiceId;
  startSec: number;
  durSec: number;
  freqHz?: number;
  velocity: number;
}

export function createPlayer(
  getScore: () => ScoreModel,
  onPlayingChange?: (playing: boolean) => void,
): Player {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let timer: number | null = null;
  let events: FlatEvent[] = [];
  let cursor = 0;
  let startClock = 0;
  let playing = false;
  let endTimer: number | null = null;

  const LOOKAHEAD_MS = 25;
  const SCHEDULE_AHEAD = 0.1; // seconds

  const flatten = (score: ScoreModel): FlatEvent[] => {
    const spu = secondsPerUnit(score);
    const list: FlatEvent[] = [];
    for (const v of VOICES) {
      for (const e of score.voices[v]) {
        list.push({
          voice: v,
          startSec: e.startUnits * spu,
          durSec: e.durUnits * spu,
          freqHz: e.pitch === undefined ? undefined : freq(e.pitch),
          velocity: e.velocity ?? 0.8,
        });
      }
    }
    list.sort((a, b) => a.startSec - b.startSec);
    return list;
  };

  const tick = () => {
    if (!ctx || !master) return;
    const now = ctx.currentTime;
    while (cursor < events.length && events[cursor].startSec + startClock < now + SCHEDULE_AHEAD) {
      const ev = events[cursor++];
      if (ev.freqHz !== undefined) {
        playString(ctx, master, ev.freqHz, startClock + ev.startSec, ev.durSec, ev.velocity);
      }
    }
    if (cursor >= events.length) {
      // Let the tail ring out, then stop.
      const last = events[events.length - 1];
      const endSec = startClock + (last ? last.startSec + last.durSec : 0);
      if (now > endSec + 0.5) stop();
    }
  };

  const play = async (): Promise<void> => {
    stop();
    ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') await ctx.resume();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    events = flatten(getScore());
    cursor = 0;
    startClock = ctx.currentTime + 0.1;
    playing = true;
    onPlayingChange?.(true);
    timer = window.setInterval(tick, LOOKAHEAD_MS);

    // Wall-clock backstop: guarantees the player stops (and the UI resets) at the
    // end of the piece even if the AudioContext clock stalls.
    const lastEnd = events.reduce((m, e) => Math.max(m, e.startSec + e.durSec), 0);
    endTimer = window.setTimeout(stop, (0.1 + lastEnd + 0.7) * 1000);
  };

  const stop = (): void => {
    if (timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
    if (endTimer !== null) {
      window.clearTimeout(endTimer);
      endTimer = null;
    }
    if (ctx) {
      ctx.close();
      ctx = null;
      master = null;
    }
    if (playing) {
      playing = false;
      onPlayingChange?.(false); // fires on manual stop AND natural end
    }
  };

  return {
    play,
    stop,
    get isPlaying() {
      return playing;
    },
  };
}
