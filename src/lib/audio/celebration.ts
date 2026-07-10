"use client";

// The "you found everything" finale: recorded applause + two party horns,
// layered into one celebratory blast. Played only as direct feedback to
// completing the last discovery (wired into markFound), never autoplay — so the
// browser's gesture requirement is already satisfied. Files live in
// /public/sounds/celebration.

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
