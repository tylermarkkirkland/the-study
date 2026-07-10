"use client";

import RoomScene3D from "@/components/RoomScene3D/RoomScene3D";
import RoomErrorBoundary from "./RoomErrorBoundary";
import FallbackDesktop from "./FallbackDesktop";
import MobileGate from "./MobileGate";
import useWebGLSupport from "@/lib/capabilities/useWebGLSupport";

/**
 * Chooses the room experience at runtime:
 *   - Small screens (phones) → a "best on a bigger screen" notice; the
 *     corner-pinned desktop can't be framed usably on a narrow viewport.
 *   - WebGL available AND motion not reduced → the live 3D room (with a
 *     fullscreen-desktop fallback if it throws at runtime).
 *   - Otherwise (no WebGL, or reduced motion) → the desktop OS fullscreen.
 *
 * While capabilities are still undetermined (first paint / SSR), shows a neutral
 * dark placeholder matching the 3D scene background so there's no fallback flash
 * that then swaps to 3D.
 */
export default function RoomExperience() {
  const caps = useWebGLSupport();

  return (
    <MobileGate>
      <RoomExperienceContent caps={caps} />
    </MobileGate>
  );
}

function RoomExperienceContent({
  caps,
}: {
  caps: ReturnType<typeof useWebGLSupport>;
}) {
  if (caps === null) {
    return (
      <div className="h-screen w-screen" style={{ background: "var(--bg)" }} />
    );
  }

  const use3D = caps.hasWebGL && !caps.prefersReducedMotion;

  if (use3D) {
    return (
      <RoomErrorBoundary fallback={<FallbackDesktop />}>
        <RoomScene3D />
      </RoomErrorBoundary>
    );
  }

  return <FallbackDesktop />;
}
