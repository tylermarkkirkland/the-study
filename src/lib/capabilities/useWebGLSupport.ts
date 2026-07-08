"use client";

import { useEffect, useState } from "react";

export type RoomCapabilities = {
  /** True if the browser can create a WebGL rendering context. */
  hasWebGL: boolean;
  /** True if the user has requested reduced motion. */
  prefersReducedMotion: boolean;
};

/**
 * Client-only capability probe used to decide between the live 3D room and the
 * flat CSS fallback. Returns `null` until it has run (first render / SSR), so
 * the server and first client paint agree and there's no hydration mismatch —
 * the caller renders a neutral placeholder while undetermined.
 */
export default function useWebGLSupport(): RoomCapabilities | null {
  const [caps, setCaps] = useState<RoomCapabilities | null>(null);

  useEffect(() => {
    let hasWebGL = false;
    try {
      const canvas = document.createElement("canvas");
      hasWebGL = Boolean(
        canvas.getContext("webgl2") ||
          canvas.getContext("webgl") ||
          canvas.getContext("experimental-webgl"),
      );
    } catch {
      hasWebGL = false;
    }

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    // Intentional: these APIs are client-only, so detection must run after mount
    // (returning null on the first render keeps SSR and hydration in agreement).
    // A single post-mount setState, not a cascading loop.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCaps({ hasWebGL, prefersReducedMotion });
  }, []);

  return caps;
}
