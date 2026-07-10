"use client";

import { useEffect, useState } from "react";

// Below this width the corner-pinned desktop can't be framed usably (the room's
// homography is calibrated for desktop viewports), so instead of shipping a
// cropped, unreadable room we show a friendly "open me on a bigger screen" note.
const MOBILE_QUERY = "(max-width: 767px)";

/**
 * Renders `children` on desktop-sized viewports; on phones it swaps in a calm,
 * on-brand notice suggesting the visitor open the link on a larger screen.
 *
 * SSR-safe: the server (and first client paint) renders as non-mobile, then a
 * post-mount media-query check corrects it. Both states sit on the same dark
 * background, so the correction isn't a jarring flash.
 */
export default function MobileGate({ children }: { children: React.ReactNode }) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  if (!isMobile) return <>{children}</>;

  return (
    <main
      className="flex h-screen w-screen flex-col items-center justify-center px-8 text-center"
      style={{ background: "var(--bg)", color: "var(--fg)" }}
    >
      <div
        aria-hidden="true"
        className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl text-3xl"
        style={{ background: "var(--bg-elevated)" }}
      >
        🖥️
      </div>
      <h1 className="text-2xl font-semibold" style={{ lineHeight: 1.2 }}>
        Best on a bigger screen
      </h1>
      <p
        className="mt-4 max-w-sm text-base"
        style={{ color: "var(--fg-muted)", lineHeight: 1.5 }}
      >
        The Study is a little desktop world built for a mouse and a full-size
        window. Open this link on a laptop or desktop to sit down at the desk and
        poke around.
      </p>
    </main>
  );
}
