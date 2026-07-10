"use client";

import { useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { unprojectToPlane } from "@/lib/room/camera";

// A flat polygon lying on the desk plane (y = planeY), defined by world-space
// (x, z) vertices. This is the sticky note's traced outline; the glow outlines
// a mesh built from it.
export type NotepadShape = {
  planeY: number;
  points: Array<[number, number]>; // [x, z]
};

type PenToolProps = {
  value: NotepadShape;
  onChange: (next: NotepadShape) => void;
  onReset: () => void;
};

const CLOSE_DIST = 12; // px: clicking this close to the first point closes the shape

export default function PenTool({ value, onChange, onReset }: PenToolProps) {
  // In-progress vertices in screen space (CSS px). Empty = not currently drawing.
  const [draft, setDraft] = useState<Array<[number, number]>>([]);
  const [copied, setCopied] = useState(false);

  const commit = (screenPts: Array<[number, number]>) => {
    if (screenPts.length < 3) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const worldPts = screenPts
      .map(([sx, sy]) => unprojectToPlane(sx, sy, vw, vh, value.planeY))
      .filter((p): p is [number, number, number] => p !== null)
      .map(([x, , z]) => [x, z] as [number, number]);
    if (worldPts.length < 3) return;
    onChange({ planeY: value.planeY, points: worldPts });
    setDraft([]);
  };

  const handleClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    const x = e.clientX;
    const y = e.clientY;
    // Close if clicking near the first point.
    if (draft.length >= 3) {
      const [fx, fy] = draft[0];
      if (Math.hypot(x - fx, y - fy) <= CLOSE_DIST) {
        commit(draft);
        return;
      }
    }
    setDraft((d) => [...d, [x, y]]);
  };

  const valuesText = `{ planeY: ${value.planeY}, points: [${value.points
    .map(([x, z]) => `[${x.toFixed(3)}, ${z.toFixed(3)}]`)
    .join(", ")}] }`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(valuesText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked — the value is shown below to copy by hand.
    }
  };

  const polyline = draft.map(([x, y]) => `${x},${y}`).join(" ");

  return (
    <>
      {/* Full-screen pen surface. Sits under the panel (z-50). */}
      <div className="fixed inset-0 z-40 cursor-crosshair" onClick={handleClick}>
        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          {draft.length > 0 ? (
            <polyline
              points={polyline}
              fill="rgba(217,70,239,0.15)"
              stroke="#e879f9"
              strokeWidth={2}
              strokeDasharray="5 4"
            />
          ) : null}
          {draft.map(([x, y], i) => (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={i === 0 ? 6 : 4}
              fill={i === 0 ? "#e879f9" : "#f5d0fe"}
              stroke="#4a044e"
              strokeWidth={1}
            />
          ))}
        </svg>
      </div>

      {/* Control panel */}
      <div
        className="pointer-events-auto fixed top-4 left-4 z-50 w-72 rounded-lg border border-white/15 bg-black/85 p-4 font-mono text-[12px] text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="group"
        aria-label="Pen tool: trace the sticky note"
      >
        <div className="mb-2 text-[13px] font-semibold">Pen tool — trace the note</div>
        <p className="mb-3 leading-snug text-white/70">
          Click to drop points around the sticky note&apos;s outline. Click the first point again (or
          &ldquo;Finish&rdquo;) to close it. The magenta shape becomes your outline.
        </p>
        <div className="mb-3 text-white/60">Points placed: {draft.length}</div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => commit(draft)}
            disabled={draft.length < 3}
            className="min-h-11 flex-1 rounded bg-fuchsia-500 px-3 font-semibold text-black hover:bg-fuchsia-400 disabled:opacity-40"
          >
            Finish shape
          </button>
          <button
            type="button"
            onClick={() => setDraft([])}
            className="min-h-11 rounded border border-white/20 px-3 text-white/80 hover:bg-white/10"
          >
            Clear
          </button>
        </div>

        <div className="mt-3 rounded bg-white/5 p-2 text-[11px] break-words text-white/80">
          {valuesText}
        </div>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={copy}
            className="min-h-11 flex-1 rounded bg-white/10 px-3 font-semibold text-white hover:bg-white/20"
          >
            {copied ? "Copied!" : "Copy values"}
          </button>
          <button
            type="button"
            onClick={onReset}
            className="min-h-11 rounded border border-white/20 px-3 text-white/80 hover:bg-white/10"
          >
            Reset
          </button>
        </div>
      </div>
    </>
  );
}
