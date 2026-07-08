"use client";

import RoomScene from "@/components/RoomScene/RoomScene";
import RoomScene3D from "@/components/RoomScene3D/RoomScene3D";
import RoomErrorBoundary from "./RoomErrorBoundary";
import useWebGLSupport from "@/lib/capabilities/useWebGLSupport";

/**
 * Chooses the room experience at runtime:
 *   - WebGL available AND motion not reduced → the live 3D room (with a CSS-room
 *     error fallback if it throws at runtime).
 *   - otherwise (no WebGL, or reduced motion) → the flat CSS room.
 *
 * While capabilities are still undetermined (first paint / SSR), shows a neutral
 * dark placeholder matching the 3D scene background so there's no CSS-room flash
 * that then swaps to 3D.
 */
export default function RoomExperience() {
  const caps = useWebGLSupport();

  if (caps === null) {
    return (
      <div className="h-screen w-screen" style={{ background: "var(--bg)" }} />
    );
  }

  const use3D = caps.hasWebGL && !caps.prefersReducedMotion;

  if (use3D) {
    return (
      <RoomErrorBoundary fallback={<RoomScene />}>
        <RoomScene3D />
      </RoomErrorBoundary>
    );
  }

  return <RoomScene />;
}
