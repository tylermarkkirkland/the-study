"use client";

import { useRef } from "react";
import { motion, useMotionValue } from "framer-motion";
import type { AppType } from "@/lib/windowManager/windowReducer";
import type { Pos } from "./DesktopIconsContext";
import AppIcon from "@/components/icons/AppIcon";

type DesktopIconProps = {
  appType: AppType;
  label: string;
  position: Pos;
  bounds: { w: number; h: number };
  /** Highlight this icon as a drop target (used for the Trash while dragging over it). */
  highlight?: boolean;
  onOpen: () => void;
  onDragMove: (pos: Pos) => void;
  onDrop: (pos: Pos) => void;
};

export default function DesktopIcon({
  appType,
  label,
  position,
  bounds,
  highlight = false,
  onOpen,
  onDragMove,
  onDrop,
}: DesktopIconProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const x = useMotionValue(position.x);
  const y = useMotionValue(position.y);
  // A real drag fires onDragStart (past a small threshold); a plain click never
  // does. We use that to tell "moved the icon" from "opened the app" so a drag
  // doesn't also launch the window on release.
  const draggedRef = useRef(false);

  const clamp = (px: number, py: number): Pos => {
    const el = ref.current;
    const w = el?.offsetWidth ?? 80;
    const h = el?.offsetHeight ?? 90;
    return {
      x: Math.min(Math.max(0, px), Math.max(0, bounds.w - w)),
      y: Math.min(Math.max(0, py), Math.max(0, bounds.h - h)),
    };
  };

  const handleDrag = () => {
    const c = clamp(x.get(), y.get());
    if (c.x !== x.get()) x.set(c.x);
    if (c.y !== y.get()) y.set(c.y);
    onDragMove(c);
  };

  const handleDragEnd = () => {
    const c = clamp(x.get(), y.get());
    x.set(c.x);
    y.set(c.y);
    onDrop(c);
  };

  return (
    <motion.button
      ref={ref}
      type="button"
      drag
      dragMomentum={false}
      dragElastic={0}
      whileDrag={{ scale: 1.06 }}
      onPointerDownCapture={() => {
        draggedRef.current = false;
      }}
      onDragStart={() => {
        draggedRef.current = true;
      }}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
      onClick={() => {
        if (!draggedRef.current) onOpen();
      }}
      aria-label={`Open ${label.replace(/\n/g, " ")}`}
      style={{ position: "absolute", left: 0, top: 0, x, y, touchAction: "none" }}
      className={`group flex w-20 cursor-grab flex-col items-center gap-1.5 rounded-xl p-2 outline-none transition-colors active:cursor-grabbing focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${
        highlight ? "bg-[var(--accent)]/25 ring-2 ring-[var(--accent)]" : "focus-visible:bg-white/10"
      }`}
    >
      <span className="pointer-events-none flex h-12 w-12 items-center justify-center">
        <AppIcon appType={appType} className="h-11 w-11" />
      </span>
      <span
        className="pointer-events-none whitespace-pre-line px-1.5 py-0.5 text-center text-[13px] leading-tight font-medium"
        style={{ color: "var(--fg)", textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
      >
        {label}
      </span>
    </motion.button>
  );
}
