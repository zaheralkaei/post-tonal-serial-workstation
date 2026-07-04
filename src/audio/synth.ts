// 24-EDO frequency + a lightweight bowed-string voice for Web Audio (§4.5).
// AbsPitch is quarter-tone steps from C0; A4 = 440 Hz sits at 4*24 + 9*2 = 114.

import { EDO } from '../core/pitch';
import type { AbsPitch } from '../types';

const ABS_A4 = 4 * EDO + 9 * 2; // 114

/** f = 440 * 2^(k/24), k = quarter-tone steps relative to A4 (§5). */
export function freq(abs: AbsPitch): number {
  return 440 * Math.pow(2, (abs - ABS_A4) / EDO);
}

/**
 * A subtractive bowed-string voice: two slightly detuned sawtooth oscillators
 * (ensemble warmth) through a lowpass "body" filter and a gentle bow-attack
 * envelope, with subtle vibrato. Handles sustained microtonal pitches well.
 */
export function playString(
  ctx: AudioContext,
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
  const peak = 0.22 * velocity;
  const attack = 0.05; // bow onset
  const release = Math.min(0.25, durationSec * 0.4);
  const end = startTime + durationSec;

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.linearRampToValueAtTime(peak, startTime + attack);
  gain.gain.setValueAtTime(peak, Math.max(startTime + attack, end - release));
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
