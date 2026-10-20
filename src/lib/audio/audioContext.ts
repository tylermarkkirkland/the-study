"use client";

// One AudioContext shared by every sound in the room (radio, guitar, discovery
// chime, finale). Sharing matters for Safari:
//
// - Safari only lets audio start inside a user gesture. Some sounds fire outside
//   one (beating the game is detected in its rAF loop; some discoveries are
//   marked from a useEffect), so we unlock the shared context on the visitor's
//   very first pointer/key/touch and every later sound reuses it, already running.
// - Safari can leave a context "interrupted" (a non-standard state) after a phone
//   call, Siri, or backgrounding, not just "suspended", so we resume on any state
//   other than running.
// - iOS mutes Web Audio under the ring/silent switch unless the page's audio
//   session is "playback" (Safari 17+). We only claim that when a sound actually
//   plays, never on unlock, so a silent visit never interrupts other apps' audio.

type AudioSessionNavigator = Navigator & { audioSession?: { type: string } };

let ctx: AudioContext | null = null;

function createContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx && ctx.state !== "closed") return ctx;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    return null;
  }
  return ctx;
}

function resumeIfNeeded(audio: AudioContext): void {
  if (audio.state !== "running" && audio.state !== "closed") {
    void audio.resume().catch(() => {
      // Not unlocked yet — the next gesture will retry.
    });
  }
}

/** The shared context, resumed if needed, for code that is about to play sound. */
export function getAudioContext(): AudioContext | null {
  const audio = createContext();
  if (!audio) return null;
  try {
    const session = (navigator as AudioSessionNavigator).audioSession;
    if (session && session.type !== "playback") session.type = "playback";
  } catch {
    // Older Safari / other browsers: no audio session API, nothing to do.
  }
  resumeIfNeeded(audio);
  return audio;
}

// Unlock on the first gesture (and re-arm if Safari later interrupts the
// context). Capture phase so it runs even when a handler stops propagation.
const UNLOCK_EVENTS = ["pointerdown", "keydown", "touchend"] as const;

function unlock(): void {
  const audio = createContext();
  if (audio) resumeIfNeeded(audio);
}

if (typeof window !== "undefined") {
  for (const type of UNLOCK_EVENTS) {
    window.addEventListener(type, unlock, { capture: true, passive: true });
  }
}
