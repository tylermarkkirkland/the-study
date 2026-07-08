"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { journalEntries } from "@/data/journalEntries";
import { DURATION, EASE_OUT } from "@/lib/motion/easings";
import styles from "./JournalOverlay.module.css";

type JournalOverlayProps = {
  open: boolean;
  onClose: () => void;
};

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export default function JournalOverlay({ open, onClose }: JournalOverlayProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
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
            aria-labelledby="journal-overlay-title"
            className={`relative max-h-[80vh] w-full max-w-xl overflow-y-auto rounded-[var(--radius-window)] p-8 pr-6 font-mono text-[var(--fg)] shadow-[var(--glass-shadow)] ${styles.paper}`}
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: DURATION.base, ease: EASE_OUT }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label="Close journal"
              className="absolute top-4 right-4 flex h-11 w-11 items-center justify-center rounded-full text-xl text-[var(--fg-muted)] hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              ×
            </button>

            <h2 id="journal-overlay-title" className="pr-12 text-2xl font-semibold tracking-tight">
              Field Notes
            </h2>

            <div className="mt-6 flex flex-col gap-8">
              {journalEntries.map((entry) => (
                <article key={entry.title}>
                  <h3 className="text-base font-semibold">{entry.title}</h3>
                  <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-[var(--fg-muted)]">
                    {entry.body}
                  </p>
                </article>
              ))}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
