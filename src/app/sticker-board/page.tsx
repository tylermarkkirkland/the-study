"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { STICKY_NOTE_COLORS } from "@/lib/stickerNoteColors";
import { DURATION, EASE_OUT } from "@/lib/motion/easings";

export default function StickerBoardPage() {
  return (
    <motion.main
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: DURATION.slow, ease: EASE_OUT }}
      className="flex min-h-screen flex-col items-center gap-8 bg-stone-100 px-6 py-12 text-stone-900"
    >
      <Link
        href="/"
        className="fixed top-5 left-5 z-50 inline-flex h-11 items-center gap-2 rounded-md border-2 border-stone-800 bg-stone-800 px-4 text-[15px] font-medium text-stone-50 shadow-[0_4px_12px_rgba(0,0,0,0.25)] hover:bg-stone-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-800"
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
          <path
            d="M9.5 3 4.5 8l5 5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Back to Desktop
      </Link>

      <div className="mt-10 flex max-w-xl flex-col items-center gap-3 text-center">
        <h1 className="text-3xl font-semibold">Sticker Board</h1>
        <p className="text-[17px] leading-relaxed text-stone-600">
          The full Sticker Board experience lives here soon. For now, enjoy
          this placeholder wall of sticky notes.
        </p>
      </div>

      <div className="grid w-full max-w-3xl grid-cols-4 gap-3 sm:grid-cols-6">
        {Array.from({ length: 24 }).map((_, i) => (
          <div
            key={i}
            className="aspect-square rounded-md shadow-sm"
            style={{ backgroundColor: STICKY_NOTE_COLORS[i % STICKY_NOTE_COLORS.length] }}
          />
        ))}
      </div>
    </motion.main>
  );
}
