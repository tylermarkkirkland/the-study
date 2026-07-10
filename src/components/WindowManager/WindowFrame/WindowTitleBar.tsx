"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import type { DragControls } from "framer-motion";

type WindowTitleBarProps = {
  title: string;
  isFocused: boolean;
  dragControls: DragControls;
  onMinimize: () => void;
  onClose: () => void;
  onZoom: () => void;
};

type TrafficLightProps = {
  color: string;
  glyph: string;
  label: string;
  onClick: () => void;
};

// A macOS-style traffic-light control: a small colored dot in a hit target that
// stays a full 44px tall (the title-bar height, so it's easy to hit) but only as
// wide as the dot, so the three cluster tightly like real traffic lights. The
// glyph fades in on hover/focus of the group so the affordance stays legible
// without cluttering the resting state.
function TrafficLight({ color, glyph, label, onClick }: TrafficLightProps) {
  return (
    <button
      type="button"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={onClick}
      aria-label={label}
      className="flex h-11 w-[13px] shrink-0 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
    >
      <span
        aria-hidden="true"
        className="flex h-[13px] w-[13px] items-center justify-center rounded-full text-[9px] font-bold leading-none text-black/60"
        style={{ background: color, boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.15)" }}
      >
        <span className="opacity-0 transition-opacity group-hover:opacity-100">{glyph}</span>
      </span>
    </button>
  );
}

export default function WindowTitleBar({
  title,
  isFocused,
  dragControls,
  onMinimize,
  onClose,
  onZoom,
}: WindowTitleBarProps) {
  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragControls.start(event);
  };

  return (
    <div
      onPointerDown={startDrag}
      className="relative flex h-11 shrink-0 cursor-grab touch-none items-center px-2 active:cursor-grabbing"
      style={{
        background: "var(--surface-bg)",
        backdropFilter: "var(--surface-blur)",
        WebkitBackdropFilter: "var(--surface-blur)" as string,
        borderBottom: "1px solid var(--glass-border)",
      }}
    >
      {/* group: hovering anywhere over the cluster reveals the glyphs, matching macOS */}
      <div className="group flex shrink-0 items-center gap-2 px-1">
        <TrafficLight color="var(--tl-close)" glyph="×" label={`Close ${title}`} onClick={onClose} />
        <TrafficLight color="var(--tl-min)" glyph="–" label={`Minimize ${title}`} onClick={onMinimize} />
        <TrafficLight color="var(--tl-zoom)" glyph="+" label={`Zoom ${title}`} onClick={onZoom} />
      </div>

      <span
        className="pointer-events-none absolute inset-x-0 mx-auto w-fit max-w-[50%] truncate px-3 text-center text-[14px] font-semibold select-none"
        style={{ color: isFocused ? "var(--fg)" : "var(--fg-muted)" }}
      >
        {title}
      </span>
    </div>
  );
}
