"use client";

import { useEffect, useRef } from "react";
import { useWindowManager } from "./WindowManagerContext";
import type { AppType } from "@/lib/windowManager/windowReducer";

/**
 * Opens the given apps once, on mount — used to greet a fresh page load with a
 * window already on the desktop (e.g. Field Notes as the starting point). Kept
 * app-agnostic: the composition root (OSDesktop) decides which apps; the window
 * system stays generic. openWindow is single-instance per app type, so this is
 * a no-op for any app the visitor already has open.
 */
export default function AutoOpenWindows({ apps }: { apps: AppType[] }) {
  const { openWindow } = useWindowManager();
  const opened = useRef(false);

  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    for (const app of apps) openWindow(app);
  }, [apps, openWindow]);

  return null;
}
