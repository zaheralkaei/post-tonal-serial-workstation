// 24-EDO frequency + a lightweight bowed-string voice for Web Audio (§4.5).
// AbsPitch is quarter-tone steps from C0; A4 = 440 Hz sits at 4*24 + 9*2 = 114.

import { EDO } from '../core/pitch';
import type { AbsPitch } from '../types';

const ABS_A4 = 4 * EDO + 9 * 2; // 114

/** Peak level of one voice at velocity 1; four voices must fit under 0 dBFS. */
const VOICE_PEAK = 0.15;
const MAX_ATTACK = 0.05; // bow onset for notes long enough to afford it
const MAX_RELEASE = 0.25;

/** f = 440 * 2^(k/24), k = quarter-tone steps relative to A4 (§5). */
export function freq(abs: AbsPitch): number {
  return 440 * Math.pow(2, (abs - ABS_A4) / EDO);
}

/**
 * Master bus every voice connects to: a gain stage into a fast limiter, so
 * dense four-voice passages cannot clip the output.
 */
export function createMasterBus(ctx: BaseAudioContext): GainNode {
  const input = ctx.createGain();
  input.gain.value = 1;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -6;
  limiter.knee.value = 4;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.2;
  input.connect(limiter);
  limiter.connect(ctx.destination);
  return input;
}

/**
 * Note envelope timings. Attack and release scale down with the note so short
 * notes still sound inside their own span (attack <= 30%, release <= 40%).
 */
export function envelopeTimes(durationSec: number): { attack: number; release: number } {
  return {
    attack: Math.min(MAX_ATTACK, durationSec * 0.3),
    release: Math.min(MAX_RELEASE, durationSec * 0.4),
  };
}

/**
 * A subtractive bowed-string voice: two slightly detuned sawtooth oscillators
 * (ensemble warmth) through a lowpass "body" filter and a gentle bow-attack
 * envelope, with subtle vibrato. Handles sustained microtonal pitches well.
 */
export function playString(
  ctx: BaseAudioContext,
  out: AudioNode,
  frequency: number,
  startTime: number,
  durationSec: number,
  velocity = 0.8,
): void {
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  osc1.type = 'sawtooth';
  osc2.type = 'sawtooth';
  osc1.frequency.value = frequency;
  osc2.frequency.value = frequency;
  osc2.detune.value = 6; // a few cents of ensemble spread

  // Vibrato (soft, string-like).
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = 5;
  lfoGain.gain.value = frequency * 0.006;
  lfo.connect(lfoGain);
  lfoGain.connect(osc1.frequency);
  lfoGain.connect(osc2.frequency);

  // Body resonance.
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = Math.min(8000, frequency * 6 + 1200);
  filter.Q.value = 0.7;

  const gain = ctx.createGain();
  const peak = VOICE_PEAK * velocity;
  const { attack, release } = envelopeTimes(durationSec);
  const end = startTime + durationSec;

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.linearRampToValueAtTime(peak, startTime + attack);
  gain.gain.setValueAtTime(peak, end - release); // >= startTime + attack by construction
  gain.gain.exponentialRampToValueAtTime(0.0001, end);

  osc1.connect(filter);
  osc2.connect(filter);
  filter.connect(gain);
  gain.connect(out);

  osc1.start(startTime);
  osc2.start(startTime);
  lfo.start(startTime);
  osc1.stop(end + 0.02);
  osc2.stop(end + 0.02);
  lfo.stop(end + 0.02);
}
