"use client";

// The "you found everything" finale: recorded applause + two party horns,
// layered into one celebratory blast. Played only as direct feedback to
// completing the last discovery (wired into markFound), never autoplay. Files
// live in /public/sounds/celebration.
//
// Plays through the room's shared AudioContext (see ./audioContext) rather than
// <audio> elements. The last discovery can land outside a user gesture (beating
// the game is detected in its rAF loop), which Safari blocks for new <audio>
// playback but not for an already-unlocked context; and iOS ignores
// HTMLAudioElement.volume, which the per-clip levels and fade rely on. The
// <audio> path is kept only as a fallback where Web Audio is missing.

import { getAudioContext } from "./audioContext";

type Clip = {
  src: string;
  volume: number;
  delayMs: number;
  // Optional offset (seconds) to begin playback into the file — the community
  // party-horn has a short dead lead-in, so it starts at 0.5s.
  startAtSec?: number;
  // Optional cap: stop the clip after this many ms (with a short fade so the cut
  // isn't a click). The party-horn recording runs ~23s — far longer than the
  // finale should last — so it's capped.
  stopMs?: number;
};

const CLIPS: Clip[] = [
  { src: "/sounds/celebration/applause-cheer.mp3", volume: 0.7, delayMs: 0 },
  { src: "/sounds/celebration/party-horn.mp3", volume: 0.6, delayMs: 0, startAtSec: 0.5, stopMs: 5000 },
  { src: "/sounds/celebration/birthday-party-horn.mp3", volume: 0.6, delayMs: 180 },
];

const FADE_MS = 400;

// Decoded once per file, so a replay (after a reset) starts promptly.
const bufferCache = new Map<string, Promise<AudioBuffer>>();

function loadBuffer(ctx: AudioContext, src: string): Promise<AudioBuffer> {
  let cached = bufferCache.get(src);
  if (!cached) {
    cached = fetch(src)
      .then((response) => response.arrayBuffer())
      .then((data) => ctx.decodeAudioData(data));
    // A failed fetch/decode shouldn't poison the cache for the next attempt.
    cached.catch(() => bufferCache.delete(src));
    bufferCache.set(src, cached);
  }
  return cached;
}

function playClipWebAudio(ctx: AudioContext, clip: Clip, requestedAt: number): void {
  loadBuffer(ctx, clip.src)
    .then((buffer) => {
      // Keep the clips' relative timing even if one file decodes slower: start
      // at requestedAt + delay, or right away if that moment has already passed.
      const when = Math.max(ctx.currentTime, requestedAt + clip.delayMs / 1000);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = clip.volume;
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start(when, clip.startAtSec ?? 0);
      if (clip.stopMs) {
        // Same linear fade as the <audio> path: hold, then ramp to silence over
        // FADE_MS so the cut lands at stopMs without a click.
        const stopAt = when + clip.stopMs / 1000;
        const fadeFrom = Math.max(when, stopAt - FADE_MS / 1000);
        gain.gain.setValueAtTime(clip.volume, fadeFrom);
        gain.gain.linearRampToValueAtTime(0, stopAt);
        source.stop(stopAt);
      }
    })
    .catch(() => {
      // Missing/undecodable clip — audio is a nice-to-have, never block.
    });
}

function fadeOutAndStop(audio: HTMLAudioElement): void {
  const startVolume = audio.volume;
  const startedAt = performance.now();
  const step = () => {
    const progress = (performance.now() - startedAt) / FADE_MS;
    if (progress >= 1) {
      audio.pause();
      return;
    }
    audio.volume = Math.max(0, startVolume * (1 - progress));
    window.setTimeout(step, 30);
  };
  step();
}

export function playCelebration(): void {
  if (typeof window === "undefined") return;
  try {
    const ctx = getAudioContext();
    if (ctx) {
      const requestedAt = ctx.currentTime;
      for (const clip of CLIPS) playClipWebAudio(ctx, clip, requestedAt);
      return;
    }
    for (const clip of CLIPS) {
      const start = () => {
        // Fresh element each time, so completing again (after a reset) replays it.
        const audio = new Audio(clip.src);
        audio.volume = clip.volume;
        const begin = () => {
          void audio.play().catch(() => {
            // Autoplay/decoding hiccup — audio is a nice-to-have, never block.
          });
          if (clip.stopMs) {
            window.setTimeout(() => fadeOutAndStop(audio), Math.max(0, clip.stopMs - FADE_MS));
          }
        };
        if (clip.startAtSec) {
          // Seek before playing so there's no blip of the lead-in.
          const seekThenBegin = () => {
            try {
              audio.currentTime = clip.startAtSec as number;
            } catch {
              // Seeking not ready — begin from the start rather than fail.
            }
            begin();
          };
          if (audio.readyState >= 1) seekThenBegin();
          else audio.addEventListener("loadedmetadata", seekThenBegin, { once: true });
        } else {
          begin();
        }
      };
      if (clip.delayMs > 0) window.setTimeout(start, clip.delayMs);
      else start();
    }
  } catch {
    // Never let audio break discovery bookkeeping.
  }
}
