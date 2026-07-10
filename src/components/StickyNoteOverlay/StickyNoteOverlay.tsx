"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { HACK_PASSCODE } from "@/lib/hackPasscode";
import { DURATION, EASE_OUT } from "@/lib/motion/easings";
import PasscodeText from "@/components/PasscodeText/PasscodeText";

type StickyNoteOverlayProps = {
  open: boolean;
  onClose: () => void;
};

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

// A zoomed-in look at the sticky note on the desk — the passcode is too small to
// read in the room, so clicking the note opens this. Same modal a11y skeleton as
// the guestbook/guitar overlays (focus trap, Escape, restore focus).
export default function StickyNoteOverlay({ open, onClose }: StickyNoteOverlayProps) {
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
            aria-labelledby="sticky-note-title"
            className="relative"
            initial={{ opacity: 0, scale: 0.9, rotate: -6, y: 12 }}
            animate={{ opacity: 1, scale: 1, rotate: -3, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, rotate: -5, y: 8 }}
            transition={{ duration: DURATION.base, ease: EASE_OUT }}
            onClick={(event) => event.stopPropagation()}
          >
            {/* The sticky note itself */}
            <div className="relative flex h-72 w-72 flex-col justify-center rounded-[2px] bg-yellow-200 px-7 py-8 text-stone-800 shadow-[0_18px_40px_rgba(0,0,0,0.45)]">
              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                aria-label="Close sticky note"
                className="absolute top-2 right-2 flex h-11 w-11 items-center justify-center rounded-full text-2xl text-stone-500 hover:bg-black/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-700"
              >
                ×
              </button>

              <h2
                id="sticky-note-title"
                className="text-[15px] font-semibold tracking-wide text-stone-600"
                style={{ fontFamily: "'Segoe Print', 'Bradley Hand', 'Comic Sans MS', cursive" }}
              >
                psst — don&apos;t forget!
              </h2>

              <p
                className="mt-3 text-[34px] font-bold leading-tight tracking-wide text-[#242a63]"
                style={{ fontFamily: "'Segoe Print', 'Bradley Hand', 'Comic Sans MS', cursive" }}
              >
                <PasscodeText code={HACK_PASSCODE} />
              </p>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
