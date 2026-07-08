"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { motion, useDragControls, useMotionValue } from "framer-motion";
import type { WindowState } from "@/lib/windowManager/windowReducer";
import { useWindowManager } from "@/components/WindowManager/WindowManagerContext";
import { appRegistry } from "@/components/WindowManager/appRegistry";
import WindowTitleBar from "./WindowTitleBar";
import { DURATION, EASE_OUT } from "@/lib/motion/easings";

type WindowFrameProps = {
  window: WindowState;
  containerRef: RefObject<HTMLDivElement | null>;
  isFocused: boolean;
};

export default function WindowFrame({ window: win, containerRef, isFocused }: WindowFrameProps) {
  const { closeWindow, focusWindow, minimizeWindow, moveWindow } = useWindowManager();
  const dragControls = useDragControls();
  // Position is driven entirely by these transform values (left/top stay 0), so
  // committing a drag never desyncs a store-driven left/top against a reset
  // offset — the source of the old one-frame "snap" on release.
  const x = useMotionValue(win.position.x);
  const y = useMotionValue(win.position.y);
  const frameRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const AppContent = appRegistry[win.appType].Component;

  // Clamp a position so the whole window stays inside the desktop area — the
  // guarantee that the title bar (and its close button) is always reachable, so
  // a window can never get stranded off-screen. Uses the container's *layout*
  // size (clientWidth/Height), not getBoundingClientRect: inside the 3D monitor
  // the desktop is wrapped in a matrix3d transform, so the bounding rect is
  // scaled screen space while window sizes are unscaled content px.
  const clamp = (pos: { x: number; y: number }) => {
    const el = containerRef.current;
    if (!el) return pos;
    const maxX = Math.max(0, el.clientWidth - win.size.width);
    const maxY = Math.max(0, el.clientHeight - win.size.height);
    return {
      x: Math.min(Math.max(0, pos.x), maxX),
      y: Math.min(Math.max(0, pos.y), maxY),
    };
  };

  // Keep the live transform in sync when position changes from outside a drag
  // (the zoom control, or the on-mount rescue below).
  useEffect(() => {
    if (isDragging.current) return;
    x.set(win.position.x);
    y.set(win.position.y);
  }, [win.position.x, win.position.y, x, y]);

  // Rescue: if a window mounts already out of bounds (e.g. a stale cascade
  // position, or a smaller viewport than last time), pull it back into reach.
  useEffect(() => {
    const clamped = clamp(win.position);
    if (clamped.x !== win.position.x || clamped.y !== win.position.y) {
      moveWindow(win.id, clamped);
    }
    // Run once on mount — clamp reads live container size, which is laid out by now.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDrag = () => {
    const clamped = clamp({ x: x.get(), y: y.get() });
    if (clamped.x !== x.get()) x.set(clamped.x);
    if (clamped.y !== y.get()) y.set(clamped.y);
  };

  const handleDragEnd = () => {
    isDragging.current = false;
    const clamped = clamp({ x: x.get(), y: y.get() });
    x.set(clamped.x);
    y.set(clamped.y);
    moveWindow(win.id, clamped);
  };

  // Green "zoom" control — a lightweight, predictable re-center of the window
  // within the desktop area (no maximize state in the reducer, and a true
  // fullscreen inside the small keystoned monitor screen would be awkward).
  const handleZoom = () => {
    const el = containerRef.current;
    if (!el) return;
    moveWindow(
      win.id,
      clamp({
        x: (el.clientWidth - win.size.width) / 2,
        y: (el.clientHeight - win.size.height) / 2,
      }),
    );
  };

  return (
    <motion.div
      ref={frameRef}
      role="dialog"
      aria-label={win.title}
      aria-hidden={win.isMinimized}
      onPointerDown={() => {
        if (!isFocused) focusWindow(win.id);
      }}
      drag={!win.isMinimized}
      dragControls={dragControls}
      dragListener={false}
      dragMomentum={false}
      dragElastic={0}
      onDragStart={() => {
        isDragging.current = true;
      }}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{
        opacity: win.isMinimized ? 0 : 1,
        scale: win.isMinimized ? 0.05 : 1,
      }}
      exit={{ opacity: 0, scale: 0.92 }}
      whileDrag={{ boxShadow: "0 24px 60px rgba(0,0,0,0.55)" }}
      transition={{ duration: DURATION.base, ease: EASE_OUT }}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: win.size.width,
        height: win.size.height,
        zIndex: win.zIndex,
        x,
        y,
        pointerEvents: win.isMinimized ? "none" : "auto",
        transformOrigin: "50% 100%",
        background: "var(--bg-elevated)",
        border: "1px solid var(--glass-border)",
        borderRadius: "var(--radius-window)",
        boxShadow: "var(--glass-shadow)",
      }}
      className="flex flex-col overflow-hidden"
    >
      <WindowTitleBar
        title={win.title}
        isFocused={isFocused}
        dragControls={dragControls}
        onMinimize={() => minimizeWindow(win.id)}
        onClose={() => closeWindow(win.id)}
        onZoom={handleZoom}
      />
      <div className="min-h-0 flex-1 overflow-auto" style={{ background: "var(--bg-elevated)", color: "var(--fg)" }}>
        <AppContent />
      </div>
    </motion.div>
  );
}
