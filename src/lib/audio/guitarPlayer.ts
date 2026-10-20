// Plucked-string synth for the guitar overlay. Karplus-Strong: a short noise
// burst fed through a feedback delay line the length of one period — the
// classic cheap-and-cheerful physical model that actually sounds like a
// plucked string, not a beep. Each pluck renders offline into an AudioBuffer
// (cached per frequency), so playback is just an AudioBufferSourceNode.
// Plays through the room's shared AudioContext (see ./audioContext).

import { getAudioContext } from "./audioContext";

let master: GainNode | null = null;
let masterCtx: AudioContext | null = null;

function ensureContext(): { ctx: AudioContext; master: GainNode } | null {
  const ctx = getAudioContext();
  if (!ctx) return null;
  if (!master || masterCtx !== ctx) {
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    masterCtx = ctx;
  }
  return { ctx, master };
}

const bufferCache = new Map<number, AudioBuffer>();

function renderPluck(audioCtx: AudioContext, frequency: number): AudioBuffer {
  const cached = bufferCache.get(frequency);
  if (cached) return cached;

  const sampleRate = audioCtx.sampleRate;
  const seconds = 2.2;
  const buffer = audioCtx.createBuffer(1, Math.floor(sampleRate * seconds), sampleRate);
  const out = buffer.getChannelData(0);

  const period = Math.floor(sampleRate / frequency);
  const delay = new Float32Array(period);
  // Initial excitation: white noise = a hard pluck.
  for (let i = 0; i < period; i++) delay[i] = Math.random() * 2 - 1;

  // 0.996 damping: strings ring a couple of seconds, like a real acoustic.
  let index = 0;
  for (let i = 0; i < out.length; i++) {
    const current = delay[index];
    const next = delay[(index + 1) % period];
    const filtered = 0.996 * 0.5 * (current + next);
    delay[index] = filtered;
    out[i] = current;
    index = (index + 1) % period;
  }

  bufferCache.set(frequency, buffer);
  return buffer;
}

/** Pluck a single string at the given frequency (Hz). */
export function pluck(frequency: number) {
  const audio = ensureContext();
  if (!audio) return;
  const { ctx: audioCtx, master: masterGain } = audio;
  const source = audioCtx.createBufferSource();
  source.buffer = renderPluck(audioCtx, frequency);
  source.connect(masterGain);
  source.start();
}

/** Strum a chord: pluck each frequency with a slight downstroke stagger. */
export function strum(frequencies: number[], strokeMs = 45) {
  const audio = ensureContext();
  if (!audio) return;
  const { ctx: audioCtx, master: masterGain } = audio;
  frequencies.forEach((frequency, i) => {
    const source = audioCtx.createBufferSource();
    source.buffer = renderPluck(audioCtx, frequency);
    source.connect(masterGain);
    source.start(audioCtx.currentTime + (i * strokeMs) / 1000);
  });
}
