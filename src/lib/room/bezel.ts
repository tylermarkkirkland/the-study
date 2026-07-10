// The black frame drawn around the corner-pinned OS screen so it reads as one
// object with the 3D monitor (hiding the slight seam at the screen opening).
// Painted as an outset box-shadow (not a border) so it never disturbs the
// calibrated corner-pin geometry, and rides the same matrix3d — so the bezel
// keeps the monitor's perspective. Tunable live via the ?bezel URL param
// (BezelTuner); paste the copied values back into DEFAULT_BEZEL to bake them in.

export type Bezel = {
  /** Solid ring thickness, px in the screen's local 800x450 content space. */
  thickness: number;
  /** Ring color. */
  color: string;
  /** Outer feather blur radius, px. */
  featherBlur: number;
  /** Outer feather spread, px. */
  featherSpread: number;
  /** Outer feather opacity, 0..1. */
  featherOpacity: number;
  /** Corner radius applied to the screen + bezel, px. */
  radius: number;
};

export const DEFAULT_BEZEL: Bezel = {
  thickness: 5,
  color: "#000000",
  featherBlur: 0,
  featherSpread: 13,
  featherOpacity: 0,
  radius: 0,
};

/** Build the `box-shadow` value: a crisp solid ring plus a soft outer feather. */
export function bezelBoxShadow(b: Bezel): string {
  return `0 0 0 ${b.thickness}px ${b.color}, 0 0 ${b.featherBlur}px ${b.featherSpread}px rgba(0, 0, 0, ${b.featherOpacity})`;
}
