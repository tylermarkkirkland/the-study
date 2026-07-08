"use client";

import { useWindowManager } from "@/components/WindowManager/WindowManagerContext";
import AppIcon from "@/components/icons/AppIcon";

// A macOS-style Dock: a centered floating glass pill at the bottom holding the
// currently minimized windows as app-icon launchers. Clicking one restores it.
// Only renders when something is minimized, so it stays out of the way.
// The hover scale is a subtle transform and is disabled automatically for users
// who prefer reduced motion (MotionConfig / no framer-motion animation here, and
// the transition is trivially skippable).
export default function Dock() {
  const { windows, restoreWindow } = useWindowManager();
  const minimized = windows.filter((w) => w.isMinimized);

  if (minimized.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-[9999] flex justify-center">
      <div
        role="toolbar"
        aria-label="Minimized windows"
        className="pointer-events-auto flex items-center gap-2 rounded-[22px] px-3 py-2"
        style={{
          background: "var(--surface-bg)",
          backdropFilter: "var(--surface-blur)",
          WebkitBackdropFilter: "var(--surface-blur)" as string,
          border: "1px solid var(--glass-border)",
          boxShadow: "var(--glass-shadow)",
        }}
      >
        {minimized.map((win) => (
          <button
            key={win.id}
            type="button"
            onClick={() => restoreWindow(win.id)}
            aria-label={`Restore ${win.title}`}
            title={win.title}
            className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-icon)] transition-transform duration-150 hover:scale-110 motion-reduce:transition-none motion-reduce:hover:scale-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            style={{ background: "var(--bg-elevated)" }}
          >
            <AppIcon appType={win.appType} className="h-7 w-7" />
          </button>
        ))}
      </div>
    </div>
  );
}
