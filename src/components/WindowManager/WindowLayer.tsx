"use client";

import type { RefObject } from "react";
import { AnimatePresence } from "framer-motion";
import { useWindowManager } from "./WindowManagerContext";
import WindowFrame from "./WindowFrame/WindowFrame";

type WindowLayerProps = {
  containerRef: RefObject<HTMLDivElement | null>;
};

export default function WindowLayer({ containerRef }: WindowLayerProps) {
  const { windows } = useWindowManager();

  const visibleZIndices = windows.filter((w) => !w.isMinimized).map((w) => w.zIndex);
  const topZIndex = visibleZIndices.length > 0 ? Math.max(...visibleZIndices) : null;

  return (
    <div className="pointer-events-none absolute inset-0">
      <AnimatePresence>
        {windows.map((win) => (
          <div key={win.id} className="pointer-events-auto">
            <WindowFrame
              window={win}
              containerRef={containerRef}
              isFocused={!win.isMinimized && win.zIndex === topZIndex}
            />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
