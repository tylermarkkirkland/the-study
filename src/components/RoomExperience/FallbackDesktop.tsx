"use client";

import OSDesktop from "@/components/OSDesktop/OSDesktop";

/**
 * The degraded experience for visitors who can't get the 3D room: no WebGL,
 * reduced-motion enabled, or a runtime error in the live scene. Rather than a
 * graybox stand-in, we render the real desktop OS fullscreen — every app still
 * works; only the 3D room around the monitor is dropped.
 *
 * OSDesktop positions itself with `absolute inset-0`, so it needs a sized,
 * relatively-positioned parent — this fullscreen container over `--bg`.
 */
export default function FallbackDesktop() {
  return (
    <main
      className="relative h-screen w-screen overflow-hidden"
      style={{ background: "var(--bg)" }}
    >
      <OSDesktop />
    </main>
  );
}
