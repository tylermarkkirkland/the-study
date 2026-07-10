"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useDiscoveries } from "@/lib/discovery/discoveryStore";
import { discoveries } from "@/data/discoveries";
import { useWindowManager } from "@/components/WindowManager/WindowManagerContext";
import { DURATION, EASE_OUT } from "@/lib/motion/easings";

// id → completed phrase, so a toast can show the same "found" line the Field
// Notes checklist does.
const FOUND_LABELS: Record<string, string> = Object.fromEntries(
  discoveries.map((d) => [d.id, d.foundLabel]),
);

const AUTO_DISMISS_MS = 5000;

type ToastItem = { key: string; label: string };

// Slides in at the top-right of the browser window (over the whole room, not the
// monitor) whenever a NEW discovery is checked off. Lives inside OSDesktop so it
// has the window manager + discovery store, but portals to document.body so it
// escapes the monitor's matrix3d transform and pins to the real viewport.
export default function DiscoveryToaster() {
  const found = useDiscoveries();
  const { openWindow } = useWindowManager();

  const [mounted, setMounted] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Baseline of already-found ids, captured on first run so returning users
  // (who load with discoveries already in localStorage) don't get a burst of
  // toasts for things they found in a past session.
  const seenRef = useRef<ReadonlySet<string> | null>(null);
  const seqRef = useRef(0);

  // Portal target (document.body) only exists on the client; render nothing
  // until mounted to avoid an SSR/hydration mismatch.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const seen = seenRef.current;
    if (seen === null) {
      seenRef.current = found; // first pass: baseline only, no toasts
      return;
    }
    const added = [...found].filter((id) => !seen.has(id) && FOUND_LABELS[id]);
    seenRef.current = found;
    if (added.length === 0) return;
    setToasts((prev) => [
      ...prev,
      ...added.map((id) => ({ key: `${id}-${seqRef.current++}`, label: FOUND_LABELS[id] })),
    ]);
  }, [found]);

  const dismiss = useCallback((key: string) => {
    setToasts((prev) => prev.filter((t) => t.key !== key));
  }, []);

  const openNotes = useCallback(() => openWindow("notebook"), [openWindow]);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="pointer-events-none fixed top-4 right-4 flex flex-col gap-2.5"
      style={{ zIndex: 2147483000 }}
      role="status"
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          // motion.div is the DIRECT child of AnimatePresence (keyed) — the shape
          // framer-motion needs to reliably track and run exit animations.
          <motion.div
            key={toast.key}
            layout
            initial={{ opacity: 0, x: 48 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 48 }}
            transition={{ duration: DURATION.base, ease: EASE_OUT }}
          >
            <ToastCard
              id={toast.key}
              label={toast.label}
              onDismiss={dismiss}
              onOpen={openNotes}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  );
}

function ToastCard({
  id,
  label,
  onDismiss,
  onOpen,
}: {
  id: string;
  label: string;
  onDismiss: (key: string) => void;
  onOpen: () => void;
}) {
  // Pause the auto-dismiss while hovered or keyboard-focused, so it can be read
  // and clicked. Unpausing restarts the full timer (simpler, and errs toward
  // giving the reader more time).
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = window.setTimeout(() => onDismiss(id), AUTO_DISMISS_MS);
    return () => window.clearTimeout(t);
  }, [paused, id, onDismiss]);

  return (
    <button
      type="button"
      onClick={() => {
        onOpen();
        onDismiss(id);
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      aria-label={`Mystery solved. ${label}. Opens Field Notes.`}
      className="pointer-events-auto flex w-[320px] items-start gap-3 rounded-xl border border-[var(--glass-border)] p-3.5 text-left shadow-[var(--glass-shadow)] transition-transform hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
      style={{ background: "var(--bg-elevated)" }}
    >
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center" aria-hidden="true">
        <svg viewBox="0 0 24 24" className="h-6 w-6">
          <circle cx="12" cy="12" r="11" fill="#34c759" />
          <path
            d="M7 12.4l3.2 3.2L17 8.8"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold text-[var(--fg)]">Mystery solved</span>
        <span className="mt-0.5 block text-[13px] leading-snug text-[var(--fg-muted)]">{label}</span>
      </span>
    </button>
  );
}
