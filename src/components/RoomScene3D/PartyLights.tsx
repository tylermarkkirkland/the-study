"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { usePartyMode } from "@/lib/party/partyStore";

// "Dim lounge" party lighting for the 3D room. Reads the shared partyStore (the
// Terminal `party` command writes it), dims the HDRI environment part-way, and
// slowly rotates a rig of soft colored point-lights that wash over the desk and
// objects. Lives inside the <Canvas> so it can use useThree()/useFrame().
//
// Tuning knobs (adjust to taste in a real browser — the headless preview
// throttles the animation loop, so timing looks off there):
const DIM = 0.45; // HDRI intensity at full party (1 = normal, lower = darker)
const FULL_INTENSITY = 12; // per-light punch at full party
const LIGHT_DISTANCE = 4; // how far each colored light reaches
const LIGHT_DECAY = 2; // physically-based falloff
const RADIUS = 0.9; // rig radius around the desk center
const HEIGHT = 1.5; // rig height (desk surface ≈ 0.8, camera target y = 1)
const ROT_SPEED = 0.35; // rad/sec — slow, lounge-y
const FADE_SPEED = 3; // eased fade in/out (~0.3s)

// Three colored lights spaced evenly around the rig.
const LIGHTS = [
  { color: "#ff2fd0", angle: 0 }, // magenta
  { color: "#29d2ff", angle: (2 * Math.PI) / 3 }, // cyan
  { color: "#63ff8f", angle: (4 * Math.PI) / 3 }, // green
];

export default function PartyLights() {
  const on = usePartyMode();
  const groupRef = useRef<THREE.Group>(null);
  // Eased 0→1 progress, so the effect fades both ways rather than snapping.
  const tRef = useRef(0);
  // Room only ever mounts when motion isn't reduced, but honor the preference
  // for the spin explicitly per the project convention.
  const reduceMotion = useRef(
    typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useFrame((state, delta) => {
    const target = on ? 1 : 0;
    tRef.current += (target - tRef.current) * Math.min(1, delta * FADE_SPEED);
    const t = tRef.current;

    // Dim the HDRI contribution (not tone-mapping exposure) so the added colored
    // lights still pop against the darker room. Read scene from the frame state
    // rather than a closed-over useThree() value.
    const envScale = 1 - (1 - DIM) * t;
    state.scene.environmentIntensity = envScale;
    state.scene.backgroundIntensity = envScale;

    const group = groupRef.current;
    if (!group) return;
    if (t > 0.001 && !reduceMotion.current) group.rotation.y += delta * ROT_SPEED;
    for (const child of group.children) {
      const light = child as THREE.PointLight;
      if (light.isPointLight) light.intensity = t * FULL_INTENSITY;
    }
  });

  return (
    <group ref={groupRef} position={[0, HEIGHT, -0.2]}>
      {LIGHTS.map((light, i) => (
        <pointLight
          key={i}
          position={[Math.cos(light.angle) * RADIUS, 0, Math.sin(light.angle) * RADIUS]}
          color={light.color}
          intensity={0}
          distance={LIGHT_DISTANCE}
          decay={LIGHT_DECAY}
        />
      ))}
    </group>
  );
}
