"use client";

import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { STICKY_NOTE_COLORS } from "@/lib/stickerNoteColors";
import { DURATION, EASE_OUT } from "@/lib/motion/easings";

type StickerBoardTransitionProps = {
  onRevealed: () => void;
};

export default function StickerBoardTransition({ onRevealed }: StickerBoardTransitionProps) {
  // Only ever rendered client-side (inside a button click handler's state),
  // so `document` is guaranteed to exist here — no mount-guard needed.
  return createPortal(
    <motion.div
      layoutId="sticker-board-surface"
      onLayoutAnimationComplete={onRevealed}
      transition={{ duration: DURATION.cinematic, ease: EASE_OUT }}
      className="fixed inset-0 z-[99999] grid grid-cols-6 gap-2 bg-stone-100 p-6 md:grid-cols-8"
    >
      {Array.from({ length: 24 }).map((_, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="rounded-md shadow-sm"
          style={{ backgroundColor: STICKY_NOTE_COLORS[i % STICKY_NOTE_COLORS.length] }}
        />
      ))}
    </motion.div>,
    document.body
  );
}
