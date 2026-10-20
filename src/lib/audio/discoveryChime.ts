"use client";

// A short, synthesized "you found something" chime, played whenever a NEW
// discovery is marked (wired into markFound in the discovery store). Synthesized
// with the Web Audio API rather than a recorded clip so it's dependency-free and
// carries no licensing — and it only ever sounds as direct feedback to a user
// action, never autoplay. To use a recorded sound instead, drop a file in
// /public/sounds and swap the body for a decoded-buffer playback.

import { getAudioContext } from "./audioContext";

// Three quick ascending notes (an E-major triad) with a soft bell-ish envelope —
// they overlap into a pleasant little arpeggio rather than three separate beeps.
const NOTES = [659.25, 830.61, 987.77]; // E5, G#5, B5
const STEP = 0.085; // seconds between note onsets
const DECAY = 0.35; // per-note tail length
const PEAK = 0.12; // gentle master volume (0–1)

export function playDiscoveryChime(): void {
  const audio = getAudioContext();
  if (!audio) return;
  try {
    const start = audio.currentTime + 0.02;
    NOTES.forEach((freq, i) => {
      const t = start + i * STEP;
      const osc = audio.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const gain = audio.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(PEAK, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + DECAY);
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start(t);
      osc.stop(t + DECAY + 0.02);
    });
  } catch {
    // Audio is a nice-to-have; never let it break discovery bookkeeping.
  }
}
