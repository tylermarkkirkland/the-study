"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { STICKY_NOTE_COLORS } from "@/lib/stickerNoteColors";
import StickerBoardTransition from "./StickerBoardTransition";

export default function StickerBoardFrame() {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const router = useRouter();

  return (
    <>
      <button
        type="button"
        onClick={() => setIsTransitioning(true)}
        aria-label="Open Sticker Board"
        disabled={isTransitioning}
        className="absolute top-[9%] left-[7%] z-20 flex h-16 w-20 items-center justify-center rounded-sm border-4 border-stone-800 bg-stone-300 p-1.5 shadow-[0_6px_16px_rgba(0,0,0,0.35)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        {isTransitioning ? (
          <div className="grid h-full w-full grid-cols-3 gap-[2px]" />
        ) : (
          <motion.div
            layoutId="sticker-board-surface"
            className="grid h-full w-full grid-cols-3 gap-[2px]"
          >
            {STICKY_NOTE_COLORS.map((color) => (
              <span
                key={color}
                aria-hidden="true"
                className="rounded-[1px]"
                style={{ backgroundColor: color }}
              />
            ))}
          </motion.div>
        )}
      </button>

      <AnimatePresence>
        {isTransitioning && (
          <StickerBoardTransition onRevealed={() => router.push("/sticker-board")} />
        )}
      </AnimatePresence>
    </>
  );
}
