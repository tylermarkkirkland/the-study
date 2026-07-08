"use client";

import { Html } from "@react-three/drei";

type InteractiveHotspotProps = {
  label: string;
  position: [number, number, number];
  // Externally controlled "engaged" state (audio playing, overlay open, ...).
  active?: boolean;
  onActivate: () => void;
  // Reports this button's own hover/focus so the parent can merge it with mesh-based hover
  // (raycasting over the object's full silhouette, handled outside this component).
  onHoverChange?: (hovered: boolean) => void;
  // Announced via aria-live while active, for interactions with no other visible/audible signal
  // (e.g. background audio). Skip it when the action already announces itself (e.g. opening a
  // role="dialog" moves focus and gets announced on its own).
  activeAnnouncement?: string;
};

// The click/keyboard/AT affordance for a hotspot — a real, focusable button anchored at the
// object's position. Purely decorative hover-only objects (no click action yet) don't need this at
// all; their glow is driven directly by mesh-hover in the parent scene, via the Outline
// post-process there.
export default function InteractiveHotspot({
  label,
  position,
  active = false,
  onActivate,
  onHoverChange,
  activeAnnouncement,
}: InteractiveHotspotProps) {
  return (
    <Html position={position} center>
      <div className="relative h-16 w-16">
        <button
          type="button"
          onClick={onActivate}
          onMouseEnter={() => onHoverChange?.(true)}
          onMouseLeave={() => onHoverChange?.(false)}
          onFocus={() => onHoverChange?.(true)}
          onBlur={() => onHoverChange?.(false)}
          aria-label={label}
          className="absolute inset-0 h-16 w-16 rounded-full bg-transparent outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900"
        />
        {activeAnnouncement ? (
          <span className="sr-only" aria-live="polite">
            {active ? activeAnnouncement : ""}
          </span>
        ) : null}
      </div>
    </Html>
  );
}
