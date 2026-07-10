"use client";

import { useState } from "react";
import type { Bezel } from "@/lib/room/bezel";

type BezelTunerProps = {
  value: Bezel;
  onChange: (next: Bezel) => void;
  onReset: () => void;
};

// Live tuner for the screen bezel (gated behind ?bezel). Drag the sliders to
// adjust the black frame around the monitor screen, then "Copy values" and
// paste them back so they can be baked into DEFAULT_BEZEL.
const SLIDERS: Array<{
  key: keyof Bezel;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
}> = [
  { key: "thickness", label: "Border thickness", min: 0, max: 60, step: 1, unit: "px" },
  { key: "radius", label: "Corner radius", min: 0, max: 40, step: 1, unit: "px" },
  { key: "featherBlur", label: "Edge blur", min: 0, max: 40, step: 1, unit: "px" },
  { key: "featherSpread", label: "Edge spread", min: 0, max: 40, step: 1, unit: "px" },
  { key: "featherOpacity", label: "Edge opacity", min: 0, max: 1, step: 0.05, unit: "" },
];

export default function BezelTuner({ value, onChange, onReset }: BezelTunerProps) {
  const [copied, setCopied] = useState(false);

  const valuesText = `{ thickness: ${value.thickness}, color: "${value.color}", featherBlur: ${value.featherBlur}, featherSpread: ${value.featherSpread}, featherOpacity: ${value.featherOpacity}, radius: ${value.radius} }`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(valuesText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked — the value is shown below to copy by hand.
    }
  };

  return (
    <div
      className="pointer-events-auto fixed top-4 left-4 z-50 w-72 rounded-lg border border-white/15 bg-black/85 p-4 font-mono text-[12px] text-white shadow-2xl"
      role="group"
      aria-label="Screen bezel tuner"
    >
      <div className="mb-2 text-[13px] font-semibold">Screen bezel</div>
      <p className="mb-3 leading-snug text-white/70">
        Adjust the black frame around the screen, then Copy the values and paste them to me.
      </p>

      {SLIDERS.map((s) => (
        <label key={s.key} className="mb-2 block">
          <span className="flex justify-between">
            <span className="text-white/70">{s.label}</span>
            <span className="text-white">
              {value[s.key]}
              {s.unit}
            </span>
          </span>
          <input
            type="range"
            min={s.min}
            max={s.max}
            step={s.step}
            value={value[s.key] as number}
            onChange={(e) => onChange({ ...value, [s.key]: Number(e.target.value) })}
            className="mt-1 w-full"
            aria-label={s.label}
          />
        </label>
      ))}

      <label className="mt-1 mb-3 flex items-center justify-between">
        <span className="text-white/70">Border color</span>
        <input
          type="color"
          value={value.color}
          onChange={(e) => onChange({ ...value, color: e.target.value })}
          aria-label="Border color"
          className="h-8 w-12 cursor-pointer rounded border border-white/20 bg-transparent"
        />
      </label>

      <div className="rounded bg-white/5 p-2 text-[11px] break-words text-white/80">{valuesText}</div>
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
  );
}
