"use client";

import { useMemo } from "react";
import * as THREE from "three";

type RoomWallProps = {
  scene: THREE.Object3D;
};

// Planks per texture tile. Shared by the texture painter and the world-space
// repeat math below so the two can never drift out of sync.
const PLANKS_PER_TILE = 8;
const PLANK_WORLD_WIDTH = 0.15; // ~0.15m per board

// Derives the back-wall placement from the loaded scene's bounding box so the wall
// sits behind everything (guitar, shelves, desk) at the room's real scale, without
// hand-authored coordinates that a GLB re-export would invalidate. The camera looks
// down −Z, so the void is at box.min.z; the wall is generously oversized because
// widening the browser reveals more of the room at the sides (fixed vertical FOV).
function useWallLayout(scene: THREE.Object3D) {
  return useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    const width = size.x + 4; // margin so edges never float into frame
    const height = 4; // rises from the floor to a plausible ceiling
    const floorY = box.min.y;

    return {
      width,
      height,
      // Centered on the room, standing on the floor, nudged just behind the
      // rearmost geometry to avoid z-fighting.
      position: [center.x, floorY + height / 2, box.min.z - 0.05] as [number, number, number],
    };
  }, [scene]);
}

// Wood plank paneling drawn to an offscreen canvas: a uniform warm base with thin
// darker seams between boards and very subtle, consistent grain. Painting the seams
// into a texture (rather than building raised slat geometry) is what keeps the wall
// from flickering light/dark between boards — a flat surface lit by the HDRI shades
// evenly, so every plank and gap stays the same tone. Kept asset-free (no image files).
function useWoodTexture() {
  return useMemo(() => {
    if (typeof document === "undefined") return null;
    const planks = PLANKS_PER_TILE; // the texture repeats horizontally across the wall
    const plankPx = 64;
    const canvas = document.createElement("canvas");
    canvas.width = planks * plankPx;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Uniform dark walnut base.
    ctx.fillStyle = "#33210f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Woodgrain: gently wavy vertical streaks, alternating a touch darker and a touch
    // lighter than the base. Deterministic (sine-driven, no randomness) so the grain is
    // stable across renders, and low-alpha so it reads as texture — not as light/dark
    // boards. It's painted into the flat texture, so it never flickers with the lighting.
    for (let x = 0; x < canvas.width; x += 3) {
      const light = Math.sin(x * 0.7) > 0.4;
      ctx.strokeStyle = light ? "rgba(120,85,50,0.07)" : "rgba(18,9,2,0.12)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      // A subtle horizontal drift down the height gives the grain an organic waver.
      const drift = Math.sin(x * 0.35) * 3;
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(
        x + drift, canvas.height * 0.33,
        x - drift, canvas.height * 0.66,
        x, canvas.height,
      );
      ctx.stroke();
    }

    // Seams between boards: a dark groove with a faint highlight edge, so the planks
    // read as distinct boards without any raised geometry.
    for (let i = 0; i <= planks; i++) {
      const x = i * plankPx;
      ctx.strokeStyle = "rgba(10,5,1,0.65)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();

      ctx.strokeStyle = "rgba(120,85,50,0.14)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 2, 0);
      ctx.lineTo(x + 2, canvas.height);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, []);
}

/**
 * A procedural back wall for the 3D office room: warm wood plank paneling. Auto-fits
 * to the loaded GLB's bounding box and is lit by the scene HDRI. It's a single FLAT
 * panel with the plank seams painted into a texture — deliberately not built from
 * raised slat geometry, whose edges and gaps caught the HDRI at varying angles and
 * made the boards flicker light/dark. A flat surface shades evenly, so the wood tone
 * stays consistent across the whole wall. Purely decorative: no pointer handlers, so
 * it never intercepts hotspot raycasts.
 */
export default function RoomWall({ scene }: RoomWallProps) {
  const layout = useWallLayout(scene);
  const wood = useWoodTexture();

  // Repeat the plank tile horizontally to a realistic board width (~0.15m each).
  if (wood) {
    const tileWorldWidth = PLANKS_PER_TILE * PLANK_WORLD_WIDTH;
    wood.repeat.set(Math.max(1, layout.width / tileWorldWidth), 1);
  }

  return (
    <mesh position={layout.position}>
      <planeGeometry args={[layout.width, layout.height]} />
      <meshStandardMaterial
        {...(wood ? { map: wood } : { color: "#33210f" })}
        roughness={0.9}
        metalness={0}
      />
    </mesh>
  );
}
