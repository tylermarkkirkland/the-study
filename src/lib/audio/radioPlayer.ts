// Web Audio player for the room's radio. Each click plays one of three "sequences" — an AM-radio
// tune-in, a themed clip (or clips), then a short tune-out — cycling 0 → 1 → 2 → 0 forever.
// Clicking again mid-sequence interrupts it with an early tune-out; the click after that advances
// to the next sequence rather than resuming.
//
// We use the Web Audio API (not <audio> elements) for two reasons: sample-accurate segment
// playback via source.start(when, offset, duration) — needed to slice the 1.0s tune-in and ~0.93s
// tune-out out of the single am-tuning file — and loudness normalization, done by measuring each
// decoded buffer's RMS and applying a matching per-clip GainNode so no clip is jarringly louder
// than another.

import { getAudioContext as getSharedAudioContext } from "./audioContext";

const BASE = "/sounds/radio";
const AM = `${BASE}/am-tuning.mp3`;
const TURRET = `${BASE}/turret-search.wav`;
const GLADOS_1 = `${BASE}/glados-nag-01.wav`;
const GLADOS_2 = `${BASE}/glados-nag-02.wav`;
const MIX = `${BASE}/radio-mix.wav`;

// A single step in a sequence: play `src` from `offset` seconds for `duration` seconds (both
// optional — omit for "whole file from the start"), then wait `gapAfterMs` before the next step.
type Segment = {
  src: string;
  offset?: number;
  duration?: number;
  gapAfterMs?: number;
};

// am-tuning is only ~5.93s long, so TUNE_OUT (offset 5.0, no duration) plays 5.0s → end ≈ 0.93s.
const TUNE_IN: Segment = { src: AM, offset: 0, duration: 1.0 };
const TUNE_OUT: Segment = { src: AM, offset: 5.0 };

const SEQUENCES: Segment[][] = [
  // 1 — Turret
  [TUNE_IN, { src: TURRET }, TUNE_OUT],
  // 2 — GLaDOS (two nags with a 1s beat between them)
  [TUNE_IN, { src: GLADOS_1, gapAfterMs: 1000 }, { src: GLADOS_2 }, TUNE_OUT],
  // 3 — Looping radio mix (plays in full unless interrupted)
  [TUNE_IN, { src: MIX }, TUNE_OUT],
];

// Loudness normalization targets. TARGET_RMS is the level every clip is scaled toward; MAX_GAIN
// caps amplification so a quiet clip can't be boosted into noise. Per-clip TRIM lets us nudge a
// specific file by ear after testing without touching the math.
const TARGET_RMS = 0.15;
const MAX_GAIN = 6;
const TRIM: Record<string, number> = {
  // e.g. [`${BASE}/radio-mix.wav`]: 0.85,
};

// Output shaping so the radio sounds like it's across the room in a small speaker rather than
// playing straight into your ears. Every clip runs through the shared chain after normalization:
//   clip gain → masterGain → highpass → lowpass → panner → speakers
type OutputProfile = {
  masterGain: number; // overall volume, 0–1 (lower = quieter)
  pan: number; // StereoPanner: -1 hard left … 0 center … +1 hard right
  highpassHz: number; // roll off rumble / deep bass below this (small-speaker thinness)
  lowpassHz: number; // roll off highs above this → muffled, "further away" tone
};

// Each kind of clip gets its own profile — a filter that flatters the music mix would smother a
// spoken line, so voices, effects, static and music are shaped independently. Values dialed in by
// ear. Both GLaDOS lines share the "glados" profile; the profile is pushed to the shared chain
// nodes just before each segment plays (see applyProfileToNodes in playSegment).
const PROFILES: Record<string, OutputProfile> = {
  mix: { masterGain: 0.29, pan: 0.2, highpassHz: 280, lowpassHz: 1250 },
  glados: { masterGain: 0.3, pan: 0.2, highpassHz: 140, lowpassHz: 1800 },
  turret: { masterGain: 0.3, pan: 0.19, highpassHz: 670, lowpassHz: 3400 },
  tuning: { masterGain: 0.4, pan: 0.2, highpassHz: 160, lowpassHz: 2050 },
};

const FALLBACK_PROFILE = "mix";

const PROFILE_BY_SRC: Record<string, string> = {
  [MIX]: "mix",
  [GLADOS_1]: "glados",
  [GLADOS_2]: "glados",
  [TURRET]: "turret",
  [AM]: "tuning",
};

function profileForSrc(src: string): OutputProfile {
  return PROFILES[PROFILE_BY_SRC[src] ?? FALLBACK_PROFILE];
}

// Plays through the room's shared AudioContext (see ./audioContext), which also
// handles Safari's gesture unlock and "interrupted" state. Throws when Web Audio
// is unavailable; every caller runs inside loadClip/playSegment's promise chain,
// whose catch treats it as a missing clip.
function getAudioContext(): AudioContext {
  const ctx = getSharedAudioContext();
  if (!ctx) throw new Error("Web Audio is unavailable");
  return ctx;
}

// The shared effect chain (master volume → band-limiting filters → stereo pan), built once per
// context. Clips connect into its input node; the chain connects to the speakers. This is what
// gives every clip the quieter, muffled, slightly-right "coming from the radio" character. The
// individual nodes are kept so each clip's profile can be pushed to them just before it plays.
let outputChainInput: AudioNode | null = null;
let masterNode: GainNode | null = null;
let highpassNode: BiquadFilterNode | null = null;
let lowpassNode: BiquadFilterNode | null = null;
let pannerNode: StereoPannerNode | null = null;

function applyProfileToNodes(p: OutputProfile): void {
  if (masterNode) masterNode.gain.value = p.masterGain;
  if (highpassNode) highpassNode.frequency.value = p.highpassHz;
  if (lowpassNode) lowpassNode.frequency.value = p.lowpassHz;
  if (pannerNode) pannerNode.pan.value = p.pan;
}

function getOutputNode(): AudioNode {
  const ctx = getAudioContext();
  if (outputChainInput) return outputChainInput;

  const initial = PROFILES[FALLBACK_PROFILE];
  masterNode = ctx.createGain();
  masterNode.gain.value = initial.masterGain;

  highpassNode = ctx.createBiquadFilter();
  highpassNode.type = "highpass";
  highpassNode.frequency.value = initial.highpassHz;

  lowpassNode = ctx.createBiquadFilter();
  lowpassNode.type = "lowpass";
  lowpassNode.frequency.value = initial.lowpassHz;

  pannerNode = ctx.createStereoPanner();
  pannerNode.pan.value = initial.pan;

  masterNode.connect(highpassNode);
  highpassNode.connect(lowpassNode);
  lowpassNode.connect(pannerNode);
  pannerNode.connect(ctx.destination);

  outputChainInput = masterNode;
  return outputChainInput;
}

// Decoded-buffer cache plus the normalization gain we computed for each src, keyed by url.
type LoadedClip = { buffer: AudioBuffer; gain: number };
const clipCache = new Map<string, Promise<LoadedClip>>();

// RMS over all channels, and peak magnitude, from a single pass over the samples.
function measure(buffer: AudioBuffer): { rms: number; peak: number } {
  let sumSquares = 0;
  let peak = 0;
  let count = 0;
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      const sample = data[i];
      sumSquares += sample * sample;
      const mag = Math.abs(sample);
      if (mag > peak) peak = mag;
    }
    count += data.length;
  }
  const rms = count > 0 ? Math.sqrt(sumSquares / count) : 0;
  return { rms, peak };
}

function loadClip(src: string): Promise<LoadedClip> {
  const cached = clipCache.get(src);
  if (cached) return cached;

  const promise = (async () => {
    const ctx = getAudioContext();
    const response = await fetch(src);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = await ctx.decodeAudioData(arrayBuffer);

    const { rms, peak } = measure(buffer);
    let gain = rms > 0 ? TARGET_RMS / rms : 1;
    gain = Math.min(gain, MAX_GAIN);
    // Never let normalization push the loudest sample past ~0.99 (clipping).
    if (peak > 0) gain = Math.min(gain, 0.99 / peak);
    gain *= TRIM[src] ?? 1;

    return { buffer, gain };
  })();

  clipCache.set(src, promise);
  return promise;
}

export type RadioController = {
  handleClick: () => void;
};

type Phase = "idle" | "playing" | "tuningOut";

/**
 * Create the radio's click controller. `onPlayingChange` is called with `true` while any audio is
 * sounding (including the tune-out) and `false` when idle, so the caller can drive the glow /
 * screen-reader announcement.
 */
export function createRadioController(onPlayingChange: (playing: boolean) => void): RadioController {
  let phase: Phase = "idle";
  let nextIndex = 0;
  // Every play/tune-out gets a fresh run id. A loop or a pending callback whose captured id no
  // longer matches `currentRun` has been superseded and must bail — this avoids the race where an
  // interrupted sequence resumes because a shared boolean was reset by the tune-out that replaced
  // it. Bumping the id is what "cancels" the previous run.
  let currentRun = 0;
  let activeStop: (() => void) | null = null;

  const setPhase = (next: Phase) => {
    phase = next;
    onPlayingChange(next !== "idle");
  };

  // Play one segment to completion (or until stopped/superseded), resolving after its optional
  // trailing gap.
  const playSegment = (segment: Segment, runId: number): Promise<void> =>
    new Promise((resolve) => {
      loadClip(segment.src)
        .then(({ buffer, gain }) => {
          if (runId !== currentRun) {
            resolve();
            return;
          }
          const ctx = getAudioContext();
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          const gainNode = ctx.createGain();
          gainNode.gain.value = gain;
          source.connect(gainNode);
          gainNode.connect(getOutputNode());
          // Shape this clip with its own profile (voices, static and music differ).
          applyProfileToNodes(profileForSrc(segment.src));

          let finished = false;
          const finish = () => {
            if (finished) return;
            finished = true;
            activeStop = null;
            if (segment.gapAfterMs && runId === currentRun) {
              window.setTimeout(resolve, segment.gapAfterMs);
            } else {
              resolve();
            }
          };

          source.onended = finish;
          activeStop = () => {
            try {
              source.onended = null;
              source.stop();
            } catch {
              // Already stopped — fine.
            }
            finish();
          };

          const offset = segment.offset ?? 0;
          if (segment.duration != null) {
            source.start(0, offset, segment.duration);
          } else {
            source.start(0, offset);
          }
        })
        .catch(() => resolve()); // Missing/failed clip shouldn't wedge the sequence.
    });

  // Play an array of segments in order. Bails out the moment this run is superseded.
  const playSegments = async (segments: Segment[], runId: number) => {
    for (const segment of segments) {
      if (runId !== currentRun) return;
      await playSegment(segment, runId);
    }
  };

  const runSequence = async (segments: Segment[], runId: number) => {
    setPhase("playing");
    await playSegments(segments, runId);
    if (runId === currentRun) setPhase("idle");
  };

  const runTuneOut = async (runId: number) => {
    setPhase("tuningOut");
    await playSegment(TUNE_OUT, runId);
    if (runId === currentRun) setPhase("idle");
  };

  const handleClick = () => {
    if (phase === "idle") {
      const index = nextIndex;
      nextIndex = (nextIndex + 1) % SEQUENCES.length;
      const runId = ++currentRun;
      void runSequence(SEQUENCES[index], runId);
    } else if (phase === "playing") {
      // Interrupt: supersede the current sequence, stop its clip, and tune out early. nextIndex was
      // already advanced when this sequence started, so the following click plays the next one.
      const runId = ++currentRun;
      activeStop?.();
      void runTuneOut(runId);
    }
    // phase === "tuningOut": ignore — it's under a second.
  };

  return { handleClick };
}
