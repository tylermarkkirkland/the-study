"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useDiscoveries } from "@/lib/discovery/discoveryStore";
import { discoveries, COMPLETION_TITLE, COMPLETION_LINES } from "@/data/discoveries";
import { DURATION, EASE_OUT } from "@/lib/motion/easings";

const TOTAL = discoveries.length;

// A centered "You did it!" card that appears alongside the confetti + fanfare
// when the last discovery is found. Lives inside OSDesktop (for the discovery
// store) but portals to document.body so it centers on the whole room, above the
// confetti. The outer layer is click-through (pointer-events: none); only the
// card itself is interactive, so the room stays usable around it.
export default function CompletionPopup() {
  const found = useDiscoveries();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  // null on first render → captured as a baseline so returning visitors who load
  // already-complete don't get the popup; only an in-session completion opens it.
  const wasCompleteRef = useRef<boolean | null>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const complete = found.size >= TOTAL;
    if (wasCompleteRef.current === null) {
      wasCompleteRef.current = complete;
      return;
    }
    if (complete && !wasCompleteRef.current) setOpen(true);
    wasCompleteRef.current = complete;
  }, [found]);

  // While open, focus the dismiss button and close on Escape.
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div
          className="pointer-events-none fixed inset-0 flex items-center justify-center p-6"
          style={{ zIndex: 2147483002 }}
        >
          <motion.div
            role="dialog"
            aria-labelledby="completion-title"
            aria-describedby="completion-body"
            initial={{ opacity: 0, scale: 0.9, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: DURATION.base, ease: EASE_OUT }}
            className="pointer-events-auto w-[min(92vw,420px)] rounded-2xl border border-[var(--glass-border)] p-6 text-center shadow-[var(--glass-shadow)]"
            style={{ background: "var(--bg-elevated)" }}
          >
            <div aria-hidden="true" className="text-4xl">🎉</div>
            <h2
              id="completion-title"
              className="mt-2 text-2xl font-semibold"
              style={{ color: "var(--fg)" }}
            >
              {COMPLETION_TITLE}
            </h2>
            <div id="completion-body" className="mt-3 space-y-1">
              <p className="text-[15px] leading-relaxed" style={{ color: "var(--fg)" }}>
                {COMPLETION_LINES[0]}
              </p>
              <p className="text-[14px] leading-relaxed" style={{ color: "var(--fg-muted)" }}>
                {COMPLETION_LINES[1]}
              </p>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={() => setOpen(false)}
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg px-6 text-[15px] font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              style={{ background: "var(--accent)" }}
            >
              Nice
            </button>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
