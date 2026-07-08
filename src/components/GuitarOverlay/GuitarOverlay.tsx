"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { pluck, strum } from "@/lib/audio/guitarPlayer";
import { markFound } from "@/lib/discovery/discoveryStore";
import { DURATION, EASE_OUT } from "@/lib/motion/easings";
import styles from "./GuitarOverlay.module.css";

type GuitarOverlayProps = {
  open: boolean;
  onClose: () => void;
};

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

// Standard tuning, low E at the top like you're looking down at the neck.
const STRINGS = [
  { name: "E", frequency: 82.41, thickness: 3.5, key: "1" },
  { name: "A", frequency: 110.0, thickness: 3, key: "2" },
  { name: "D", frequency: 146.83, thickness: 2.6, key: "3" },
  { name: "G", frequency: 196.0, thickness: 2.2, key: "4" },
  { name: "B", frequency: 246.94, thickness: 1.8, key: "5" },
  { name: "e", frequency: 329.63, thickness: 1.5, key: "6" },
];

// A campfire's worth of chords. Each is the strings' fretted frequencies,
// low to high, strummed with a downstroke stagger.
const CHORDS: { name: string; key: string; frequencies: number[] }[] = [
  { name: "Em", key: "q", frequencies: [82.41, 123.47, 164.81, 196.0, 246.94, 329.63] },
  { name: "G", key: "w", frequencies: [98.0, 123.47, 146.83, 196.0, 246.94, 392.0] },
  { name: "C", key: "e", frequencies: [130.81, 164.81, 196.0, 261.63, 329.63] },
  { name: "D", key: "r", frequencies: [146.83, 220.0, 293.66, 369.99] },
];

// The guitar in the corner, playable. Drag or click across the strings to
// strum, or lean on the chord pads. Same modal a11y skeleton as the guestbook.
export default function GuitarOverlay({ open, onClose }: GuitarOverlayProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Which strings are visually vibrating right now. Set on pluck, cleared on a
  // timer just past the CSS animation's length — state-driven so React and the
  // animation never fight over the class.
  const [vibrating, setVibrating] = useState<Record<string, boolean>>({});
  const vibrationTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pointerDownRef = useRef(false);

  const vibrate = (name: string) => {
    clearTimeout(vibrationTimers.current[name]);
    setVibrating((prev) => ({ ...prev, [name]: true }));
    vibrationTimers.current[name] = setTimeout(() => {
      setVibrating((prev) => ({ ...prev, [name]: false }));
    }, 380);
  };

  const pluckString = (name: string, frequency: number) => {
    pluck(frequency);
    markFound("guitar-play");
    vibrate(name);
  };

  const strumChord = (chord: (typeof CHORDS)[number]) => {
    strum(chord.frequencies);
    markFound("guitar-play");
    // Ripple the visual down all six strings like a real downstroke.
    STRINGS.forEach((s, i) => {
      setTimeout(() => vibrate(s.name), i * 45);
    });
  };

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      // Number keys pluck strings, QWER strums chords — playable without a mouse.
      const stringMatch = STRINGS.find((s) => s.key === event.key);
      if (stringMatch) {
        pluckString(stringMatch.name, stringMatch.frequency);
        return;
      }
      const chordMatch = CHORDS.find((c) => c.key === event.key.toLowerCase());
      if (chordMatch) {
        strumChord(chordMatch);
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previouslyFocused.current?.focus();
    };
    // pluckString/strumChord are stable in behavior; re-binding on open/close is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: DURATION.base, ease: EASE_OUT }}
          onClick={onClose}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="guitar-overlay-title"
            className={`relative w-full max-w-lg rounded-[var(--radius-window)] p-8 pr-6 text-[var(--fg)] shadow-[var(--glass-shadow)] ${styles.paper}`}
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: DURATION.base, ease: EASE_OUT }}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={() => (pointerDownRef.current = true)}
            onPointerUp={() => (pointerDownRef.current = false)}
            onPointerLeave={() => (pointerDownRef.current = false)}
          >
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label="Close guitar"
              className="absolute top-4 right-4 flex h-11 w-11 items-center justify-center rounded-full text-xl text-[var(--fg-muted)] hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              ×
            </button>

            <h2 id="guitar-overlay-title" className="pr-12 text-2xl font-semibold tracking-tight">
              Guitar
            </h2>
            <p className="mt-1 text-[14px] text-[var(--fg-muted)]">
              Click a string, or drag across all six. Keys 1–6 pluck, Q/W/E/R strum a chord.
            </p>

            {/* Strings — drag across them with the pointer held down to strum. */}
            <div className="mt-5 rounded-lg border border-[var(--glass-border)] bg-black/25 px-4 py-2">
              {STRINGS.map((s) => (
                <button
                  key={s.name}
                  type="button"
                  aria-label={`Pluck ${s.name} string`}
                  className={`${styles.string} ${vibrating[s.name] ? styles.vibrating : ""}`}
                  style={{ ["--string-thickness" as string]: `${s.thickness}px` }}
                  onPointerDown={() => pluckString(s.name, s.frequency)}
                  onPointerEnter={() => {
                    if (pointerDownRef.current) pluckString(s.name, s.frequency);
                  }}
                >
                  <span className="sr-only">{s.name}</span>
                </button>
              ))}
            </div>

            {/* Chord pads */}
            <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Chords">
              {CHORDS.map((chord) => (
                <button
                  key={chord.name}
                  type="button"
                  onClick={() => strumChord(chord)}
                  className="min-h-11 min-w-16 rounded-lg border border-[var(--glass-border)] bg-white/5 px-4 text-[15px] font-semibold text-[var(--fg)] hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                >
                  {chord.name}
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
