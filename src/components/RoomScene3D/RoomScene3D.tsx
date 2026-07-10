"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { Environment, Html, useGLTF, useProgress } from "@react-three/drei";
import * as THREE from "three";
import { EffectComposer, Outline } from "@react-three/postprocessing";
import OSDesktop from "@/components/OSDesktop/OSDesktop";
import DeskDustClue from "@/components/DeskDustClue/DeskDustClue";
import InteractiveHotspot from "@/components/InteractiveHotspot/InteractiveHotspot";
import GuestbookOverlay from "@/components/GuestbookOverlay/GuestbookOverlay";
import GuitarOverlay from "@/components/GuitarOverlay/GuitarOverlay";
import StickyNoteOverlay from "@/components/StickyNoteOverlay/StickyNoteOverlay";
import PenTool, { type NotepadShape } from "@/components/PenTool/PenTool";
import BezelTuner from "@/components/BezelTuner/BezelTuner";
import { type Bezel, DEFAULT_BEZEL, bezelBoxShadow } from "@/lib/room/bezel";
import { usePartyMode } from "@/lib/party/partyStore";
import { CAMERA_POSITION, CAMERA_TARGET, FOV } from "@/lib/room/camera";
import overlayStyles from "./MonitorScreenOverlay.module.css";
import RoomWall from "@/components/RoomScene3D/RoomWall";
import PartyLights from "@/components/RoomScene3D/PartyLights";
import { hotspots } from "@/data/hotspots";
import { createRadioController, type RadioController } from "@/lib/audio/radioPlayer";
import { markFound } from "@/lib/discovery/discoveryStore";

// Locates each configured hotspot's matching nodes by name, rather than hand-authoring
// coordinates — survives re-exports of office.glb. A config with zero matches is omitted (not
// defaulted to the origin) and warned about, so a naming mismatch is loud rather than a silently
// floating glow. Returns the actual node references (not just a computed center) because both the
// silhouette glow and pointer hit-testing need the real geometry, not a point.
function useHotspotNodes(scene: THREE.Object3D) {
  return useMemo(() => {
    scene.updateMatrixWorld(true);
    const nodesById: Record<string, THREE.Object3D[]> = {};

    for (const config of hotspots) {
      const patterns = (
        Array.isArray(config.nodeNameMatch) ? config.nodeNameMatch : [config.nodeNameMatch]
      ).map((p) => p.toLowerCase());
      const matches: THREE.Object3D[] = [];
      scene.traverse((node) => {
        const name = node.name.toLowerCase();
        if (patterns.some((p) => name.includes(p))) {
          matches.push(node);
        }
      });

      if (matches.length === 0) {
        console.warn(`Hotspot "${config.id}": no scene node matched ${JSON.stringify(config.nodeNameMatch)}.`);
        continue;
      }

      nodesById[config.id] = matches;
    }

    return nodesById;
  }, [scene]);
}

// Only the clickable hotspots (radio, journal) need a real anchored button — derive its position
// from the same nodes as the glow, so the two never drift apart.
function useHotspotPositions(nodesById: Record<string, THREE.Object3D[]>) {
  return useMemo(() => {
    const positions: Record<string, [number, number, number]> = {};
    for (const [id, nodes] of Object.entries(nodesById)) {
      const box = new THREE.Box3();
      nodes.forEach((node) => box.expandByObject(node));
      const center = box.getCenter(new THREE.Vector3());
      positions[id] = [center.x, center.y, center.z];
    }
    return positions;
  }, [nodesById]);
}

// Walks up from a raycast hit (a leaf mesh) through its ancestors to find which configured
// hotspot, if any, it belongs to — covers the object's whole silhouette, not just a small anchored
// hit target, and handles hotspots whose matched node has its own child meshes.
function resolveHotspotId(
  object: THREE.Object3D | null,
  nodesById: Record<string, THREE.Object3D[]>,
): string | null {
  let current: THREE.Object3D | null = object;
  while (current) {
    for (const [id, nodes] of Object.entries(nodesById)) {
      if (nodes.includes(current)) return id;
    }
    current = current.parent;
  }
  return null;
}

// Fixed transform for the in-world passcode writing on the sticky note (tuned
// against the room). Visible but small — the readable version is the click-to-
// open modal. position = absolute world point; rotZDeg spins the flat text,
// tiltXDeg leans it off the flat-on-desk lay, distanceFactor sets its size.
type DustClueTransform = {
  position: [number, number, number];
  rotZDeg: number;
  tiltXDeg: number;
  distanceFactor: number;
};

const DUST_CLUE: DustClueTransform = {
  position: [0.47, 0.8, -0.18],
  rotZDeg: -52.0,
  tiltXDeg: 0,
  distanceFactor: 0.35,
};

// The sticky note's traced outline — a flat polygon on the desk plane, used as
// the glow/hover/click shape. Traced with the pen tool (?tune) because the
// note sits at an angle and the optimizer merges the notepad group into one
// wide mesh, so neither a box nor runtime bounds fit it. Default is a rough quad
// around the stack; retrace to refine. points are world [x, z] at y = planeY.
const NOTEPAD_SHAPE: NotepadShape = {
  planeY: 0.792,
  points: [
    [0.469, -0.104],
    [0.406, -0.137],
    [0.431, -0.191],
    [0.467, -0.257],
    [0.532, -0.22],
    [0.498, -0.158],
  ],
};

// Hand-built in Blender by the user: metal office desk, LG monitor/keyboard/
// mouse, chair, shelf, radio, guitar, and desk clutter. Exported at 519MB and
// packed down to ~10.5MB with `gltf-transform optimize --compress draco
// --texture-compress webp --texture-size 2048`. Includes a `ScreenAnchor`
// node (not used by the corner-pin overlay below, which is positioned by
// hand instead — see MonitorScreenOverlay).
type OfficeSceneProps = {
  journalOpen: boolean;
  onOpenJournal: () => void;
  guitarOpen: boolean;
  onOpenGuitar: () => void;
  stickyOpen: boolean;
  onOpenSticky: () => void;
  notepadShape: NotepadShape;
  debugBox: boolean;
};

function OfficeScene({
  journalOpen,
  onOpenJournal,
  guitarOpen,
  onOpenGuitar,
  stickyOpen,
  onOpenSticky,
  notepadShape,
  debugBox,
}: OfficeSceneProps) {
  const { scene } = useGLTF("/models/office.glb");
  const hotspotNodes = useHotspotNodes(scene);
  const hotspotPositions = useHotspotPositions(hotspotNodes);

  const [radioPlaying, setRadioPlaying] = useState(false);
  // One controller instance for the component's lifetime; it owns the click state machine
  // (which sequence is next, whether one is playing) and drives radioPlaying for the glow.
  const radioControllerRef = useRef<RadioController | null>(null);

  const playRadio = () => {
    if (!radioControllerRef.current) {
      radioControllerRef.current = createRadioController(setRadioPlaying);
    }
    radioControllerRef.current.handleClick();
    markFound("radio-play");
  };

  // Mesh-accurate hover: covers the object's whole silhouette, not just the small anchored button
  // used for click/keyboard. Only re-renders when the resolved hotspot id actually changes.
  const [meshHoveredId, setMeshHoveredId] = useState<string | null>(null);
  const meshHoveredIdRef = useRef<string | null>(null);
  // The invisible slab we glow for the notepad (see notepadProxy) — outlined
  // instead of the real note mesh so the glow hugs only the bit above the desk.
  // State (via a callback ref) rather than a ref, so the Outline selection
  // recomputes once the mesh mounts.
  const [notepadProxyMesh, setNotepadProxyMesh] = useState<THREE.Mesh | null>(null);

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    const id = resolveHotspotId(event.object, hotspotNodes);
    if (id !== meshHoveredIdRef.current) {
      meshHoveredIdRef.current = id;
      setMeshHoveredId(id);
    }
  };

  const handlePointerOut = () => {
    if (meshHoveredIdRef.current !== null) {
      meshHoveredIdRef.current = null;
      setMeshHoveredId(null);
    }
  };

  // The journal is a flat portfolio lying on the desk, nearly coplanar with the desk surface. Seen
  // at the scene's grazing camera angle, ray hits on its thin top faces are interleaved with hits
  // on the desk right behind them, so raw mesh-hover only lit up a small central patch. An
  // invisible box standing just above the notebook's footprint gives R3F a single, unambiguous
  // closest-hit across the whole object (the desk can't win in front of it), so hover — and the
  // resulting glow of the real binder mesh — covers the entire notebook. Volumetric props (radio,
  // guitar) face the camera and don't need this.
  const setJournalHovered = (hovered: boolean) => {
    if (hovered) {
      if (meshHoveredIdRef.current !== "journal") {
        meshHoveredIdRef.current = "journal";
        setMeshHoveredId("journal");
      }
    } else if (meshHoveredIdRef.current === "journal") {
      // Only clear if we're still the active hover — moving straight onto another prop will have
      // already replaced it.
      meshHoveredIdRef.current = null;
      setMeshHoveredId(null);
    }
  };

  // The sticky-note stack is small and flush with the desk, so mesh-hover on the
  // real note is unreliable — same fix as the journal: an invisible proxy owns
  // hover/click.
  const setNotepadHovered = (hovered: boolean) => {
    if (hovered) {
      if (meshHoveredIdRef.current !== "notepad") {
        meshHoveredIdRef.current = "notepad";
        setMeshHoveredId("notepad");
      }
    } else if (meshHoveredIdRef.current === "notepad") {
      meshHoveredIdRef.current = null;
      setMeshHoveredId(null);
    }
  };

  useEffect(() => {
    const clickable =
      meshHoveredId === "radio" ||
      meshHoveredId === "journal" ||
      meshHoveredId === "guitar" ||
      meshHoveredId === "notepad";
    document.body.style.cursor = clickable ? "pointer" : "auto";
    return () => {
      document.body.style.cursor = "auto";
    };
  }, [meshHoveredId]);

  // Every hotspot mesh shows a pointer cursor, so clicking the mesh itself must
  // work too — not just the small anchored button. Resolve the hit like hover does.
  const handleSceneClick = (event: ThreeEvent<MouseEvent>) => {
    const id = resolveHotspotId(event.object, hotspotNodes);
    if (!id) return;
    event.stopPropagation();
    if (id === "radio") playRadio();
    else if (id === "journal") onOpenJournal();
    else if (id === "guitar") onOpenGuitar();
    else if (id === "notepad") onOpenSticky();
  };

  // The button itself still reports its own hover/focus (its small area, and the only path for
  // keyboard users) — merged with mesh-hover so the glow lights up either way.
  const [radioDomHovered, setRadioDomHovered] = useState(false);
  const [journalDomHovered, setJournalDomHovered] = useState(false);
  const [guitarDomHovered, setGuitarDomHovered] = useState(false);
  const [notepadDomHovered, setNotepadDomHovered] = useState(false);

  // Which hotspots should be glowing right now — either "engaged" (radio playing / journal open)
  // or hovered (over the object's full silhouette via raycasting, or over its anchored button for
  // pointer/keyboard users).
  const glowingIds = new Set<string>();
  if (radioPlaying || radioDomHovered || meshHoveredId === "radio") glowingIds.add("radio");
  if (journalOpen || journalDomHovered || meshHoveredId === "journal") glowingIds.add("journal");
  if (guitarOpen || guitarDomHovered || meshHoveredId === "guitar") glowingIds.add("guitar");
  if (stickyOpen || notepadDomHovered || meshHoveredId === "notepad") glowingIds.add("notepad");
  const glowKey = [...glowingIds].sort().join(",");

  // The Outline post-process highlights whole meshes, so flatten each active hotspot's nodes down
  // to their descendant meshes. This screen-space silhouette trace is why the glow finally works
  // for every shape at once: it outlines whatever the object actually looks like on screen —
  // immune to thin axes, hard edges, seams, and depth-fighting, all of which broke the earlier
  // geometry-inflation shells (see the git history of the deleted HotspotSilhouetteGlow).
  const outlineSelection = useMemo(() => {
    const meshes: THREE.Object3D[] = [];
    glowingIds.forEach((id) => {
      // The notepad glows via its surface proxy (below), not the real note mesh,
      // which extends down into the desk — outlining that would light up the
      // buried body too.
      if (id === "notepad") return;
      hotspotNodes[id]?.forEach((node) =>
        node.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) meshes.push(child);
        }),
      );
    });
    if (glowingIds.has("notepad") && notepadProxyMesh) meshes.push(notepadProxyMesh);
    return meshes;
    // glowKey captures exactly which ids are active; glowingIds itself is a fresh Set each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [glowKey, hotspotNodes, notepadProxyMesh]);

  // Invisible hit-proxy for the journal (see setJournalHovered): a box standing on the desk over
  // the notebook's world footprint, so the whole notebook is hoverable/clickable despite the flat
  // mesh losing the depth race to the desk at a grazing angle.
  const journalProxy = useMemo(() => {
    const nodes = hotspotNodes.journal;
    if (!nodes || nodes.length === 0) return null;
    const node = nodes[0] as THREE.Mesh;
    const geom = node.geometry as THREE.BufferGeometry | undefined;
    if (!geom) return null;
    geom.computeBoundingBox();
    const lb = geom.boundingBox;
    if (!lb) return null;
    // The journal lies flat but rotated on the desk, so an axis-aligned box
    // overhangs its corners. Build an ORIENTED box from the notebook's own local
    // bounding box + world transform, so the hit area hugs the folio exactly.
    const localSize = lb.getSize(new THREE.Vector3());
    const localCenter = lb.getCenter(new THREE.Vector3());
    node.updateWorldMatrix(true, false);
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scl = new THREE.Vector3();
    node.matrixWorld.decompose(pos, quat, scl);
    const worldCenter = localCenter.applyMatrix4(node.matrixWorld);
    // Thicken whichever axis is the folio's flat normal so the box stands a little
    // proud of the desk and wins the raycast depth race, without ballooning.
    const dims: [number, number, number] = [
      localSize.x * scl.x,
      localSize.y * scl.y,
      localSize.z * scl.z,
    ];
    const thinAxis = dims.indexOf(Math.min(...dims));
    dims[thinAxis] = Math.max(dims[thinAxis], 0.05);
    return {
      position: worldCenter.toArray() as [number, number, number],
      quaternion: [quat.x, quat.y, quat.z, quat.w] as [number, number, number, number],
      args: dims,
    };
  }, [hotspotNodes]);

  // Flat polygon geometry for the sticky-note outline, laid on the desk plane.
  // Built from the traced (x, z) points: a Shape in XY, rotated flat and lifted
  // to planeY so each vertex lands at world (x, planeY, z).
  const notepadGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    notepadShape.points.forEach(([x, z], i) => {
      if (i === 0) shape.moveTo(x, -z);
      else shape.lineTo(x, -z);
    });
    const geom = new THREE.ShapeGeometry(shape);
    geom.rotateX(-Math.PI / 2);
    geom.translate(0, notepadShape.planeY, 0);
    return geom;
  }, [notepadShape]);

  // Centroid of the outline, for the keyboard/AT hotspot button.
  const notepadCentroid = useMemo<[number, number, number]>(() => {
    const pts = notepadShape.points;
    const n = pts.length || 1;
    const cx = pts.reduce((s, p) => s + p[0], 0) / n;
    const cz = pts.reduce((s, p) => s + p[1], 0) / n;
    return [cx, notepadShape.planeY, cz];
  }, [notepadShape]);

  return (
    <>
      <primitive
        object={scene}
        onPointerMove={handlePointerMove}
        onPointerOut={handlePointerOut}
        onClick={handleSceneClick}
      />

      <RoomWall scene={scene} />

      {/* The passcode written on the sticky note, laid flat on it so there's
          visible writing before you click. Small on purpose — the readable copy
          is the click-to-open modal. pointer-events off so it never eats the
          note's hover/click. */}
      <Html
        position={DUST_CLUE.position}
        rotation={[
          (-90 + DUST_CLUE.tiltXDeg) * (Math.PI / 180),
          0,
          (DUST_CLUE.rotZDeg * Math.PI) / 180,
        ]}
        transform
        distanceFactor={DUST_CLUE.distanceFactor}
        center
        style={{ pointerEvents: "none" }}
      >
        <DeskDustClue />
      </Html>

      <mesh
        ref={setNotepadProxyMesh}
        geometry={notepadGeometry}
        onPointerOver={(event) => {
          event.stopPropagation();
          setNotepadHovered(true);
        }}
        onPointerOut={() => setNotepadHovered(false)}
        onClick={(event) => {
          event.stopPropagation();
          onOpenSticky();
        }}
      >
        {/* Invisible in normal use (just the hover/click + glow-outline shape).
            When tracing (?tune) it turns bright magenta + always-on-top so the
            traced outline can be seen against the note. */}
        {debugBox ? (
          <meshBasicMaterial color="#ff00ff" side={THREE.DoubleSide} transparent opacity={0.6} depthTest={false} />
        ) : (
          <meshBasicMaterial side={THREE.DoubleSide} transparent opacity={0} depthWrite={false} />
        )}
      </mesh>

      {journalProxy ? (
        <mesh
          position={journalProxy.position}
          quaternion={journalProxy.quaternion}
          onPointerOver={(event) => {
            event.stopPropagation();
            setJournalHovered(true);
          }}
          onPointerOut={() => setJournalHovered(false)}
          onClick={(event) => {
            event.stopPropagation();
            onOpenJournal();
          }}
        >
          <boxGeometry args={journalProxy.args} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      ) : null}

      {/* xRay draws the outline even where the object is occluded in the depth buffer. It's needed
          for the journal: it lies flat and flush on the desk, so the outline pass reads its
          silhouette as "hidden" behind the desk and, without xRay, suppresses it almost entirely.
          The upright props (radio, guitar) look the same either way since little sits in front of
          them from this camera. */}
      <EffectComposer autoClear={false}>
        <Outline
          selection={outlineSelection}
          edgeStrength={10}
          visibleEdgeColor={0xffb24d}
          hiddenEdgeColor={0xffb24d}
          blur
          xRay={true}
        />
      </EffectComposer>

      {hotspotPositions.radio ? (
        <InteractiveHotspot
          label="Play radio"
          position={hotspotPositions.radio}
          active={radioPlaying}
          onActivate={playRadio}
          onHoverChange={setRadioDomHovered}
          activeAnnouncement="Playing radio"
        />
      ) : null}

      {hotspotPositions.journal ? (
        <InteractiveHotspot
          label="Sign the guestbook"
          position={hotspotPositions.journal}
          active={journalOpen}
          onActivate={onOpenJournal}
          onHoverChange={setJournalDomHovered}
        />
      ) : null}

      {hotspotPositions.guitar ? (
        <InteractiveHotspot
          label="Play the guitar"
          position={hotspotPositions.guitar}
          active={guitarOpen}
          onActivate={onOpenGuitar}
          onHoverChange={setGuitarDomHovered}
        />
      ) : null}

      <InteractiveHotspot
        label="Read the sticky note"
        position={notepadCentroid}
        active={stickyOpen}
        onActivate={onOpenSticky}
        onHoverChange={setNotepadDomHovered}
      />
    </>
  );
}


// Cursor-driven tilt removed for now — it was the source of most of the
// screen-alignment debugging pain, and wasn't even the actual cause of the
// last mismatch (the corner-pin overlay is plain 2D and was never
// camera-driven). Simpler to get the static screen alignment fully correct
// first, then reintroduce a subtle tilt later as an isolated addition.
// Sets the camera's look-at direction once — no per-frame work, since the
// camera never moves.
function StaticCamera() {
  const { camera } = useThree();
  useEffect(() => {
    camera.lookAt(...CAMERA_TARGET);
  }, [camera]);
  return null;
}

// 16:9, matching the calibrated quad's real aspect ratio (see
// CALIBRATED_CORNERS) — sized up from the original 400x225 probe so the OS's
// authored pixel sizes (windows up to 520x420, 44px touch targets) have room
// to lay out without the homography having to distort the aspect ratio.
const CONTENT_WIDTH = 800;
const CONTENT_HEIGHT = 450;

type Point = { x: number; y: number };
type Corners = { tl: Point; tr: Point; br: Point; bl: Point };
type CornerKey = keyof Corners;

const CORNER_KEYS: CornerKey[] = ["tl", "tr", "br", "bl"];

// Solves for the 3x3 projective ("homography") matrix mapping a
// CONTENT_WIDTH x CONTENT_HEIGHT axis-aligned rectangle onto an arbitrary
// quadrilateral (the 4 dragged corners), using Paul Heckbert's closed-form
// "square-to-quad" derivation, then embeds it into a CSS `matrix3d`. This is
// the standard "corner pin" / keystone-correction technique — unlike the
// earlier position+scale+tilt approach, it can match ANY quad shape exactly,
// not just ones a flat plane can produce under simple rotation.
function cornersToMatrix3d({ tl, tr, br, bl }: Corners): string {
  const [x0, y0] = [tl.x, tl.y];
  const [x1, y1] = [tr.x, tr.y];
  const [x2, y2] = [br.x, br.y];
  const [x3, y3] = [bl.x, bl.y];

  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const dy3 = y0 - y1 + y2 - y3;

  let a13 = 0;
  let a23 = 0;
  const denom = dx1 * dy2 - dx2 * dy1;
  if ((dx3 !== 0 || dy3 !== 0) && denom !== 0) {
    a13 = (dx3 * dy2 - dx2 * dy3) / denom;
    a23 = (dx1 * dy3 - dy1 * dx3) / denom;
  }

  const a11 = (x1 - x0 + a13 * x1) / CONTENT_WIDTH;
  const a12 = (y1 - y0 + a13 * y1) / CONTENT_WIDTH;
  const a13Scaled = a13 / CONTENT_WIDTH;
  const a21 = (x3 - x0 + a23 * x3) / CONTENT_HEIGHT;
  const a22 = (y3 - y0 + a23 * y3) / CONTENT_HEIGHT;
  const a23Scaled = a23 / CONTENT_HEIGHT;
  const a31 = x0;
  const a32 = y0;
  const a33 = 1;

  // CSS matrix3d is column-major: [x-basis][y-basis][z-basis][translation].
  // z is left untouched (0 in, 0 out) since the content is flat.
  const m = [
    a11, a12, 0, a13Scaled,
    a21, a22, 0, a23Scaled,
    0, 0, 1, 0,
    a31, a32, 0, a33,
  ];
  return `matrix3d(${m.join(",")})`;
}

// Calibrated by the user directly in their own browser via the "Copy exact
// values" button (raw clipboard JSON, not hand-transcribed — see
// docs/room-3d-roadmap.md for why that mattered), at this exact reference
// viewport size. With a fixed-vertical-FOV perspective camera, an
// already-framed object's on-screen size/position scales purely with canvas
// HEIGHT — widening the window just reveals more of the room at the sides
// without moving what's already in frame. `toDisplayCorner`
// below uses that to make the calibration resize-independent without touching
// the 3D scene at all.
const REFERENCE_VIEWPORT = { width: 1536, height: 743 };
const CALIBRATED_CORNERS: Corners = {
  tl: { x: 400.5916748046875, y: 51.853126525878906 },
  tr: { x: 1126.902099609375, y: 55.181251525878906 },
  br: { x: 1122.27294921875, y: 460.01983642578125 },
  bl: { x: 405.24688720703125, y: 461.3156433105469 },
};

function toDisplayCorner(ref: Point, refSize: { width: number; height: number }, curSize: { width: number; height: number }): Point {
  const scale = curSize.height / refSize.height;
  return {
    x: curSize.width / 2 + (ref.x - refSize.width / 2) * scale,
    y: curSize.height / 2 + (ref.y - refSize.height / 2) * scale,
  };
}

function useViewportSize() {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const update = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return size;
}

// Corner-pinned OS desktop: projects the same OSDesktop used on the flat
// Monitor screen onto the office.glb monitor's real screen quad, locked to
// CALIBRATED_CORNERS. Corners live in REFERENCE_VIEWPORT space and rescale to
// the live window size every render, so resizing keeps the screen in place
// on the monitor without touching the 3D scene at all.
function MonitorScreenOverlay({ bezel }: { bezel: Bezel }) {
  const viewport = useViewportSize();
  const party = usePartyMode();

  if (!viewport.width) return null;

  const displayCorners = CORNER_KEYS.reduce((acc, key) => {
    acc[key] = toDisplayCorner(CALIBRATED_CORNERS[key], REFERENCE_VIEWPORT, viewport);
    return acc;
  }, {} as Corners);

  const screenTransform = cornersToMatrix3d(displayCorners);

  return (
    <div className="pointer-events-none absolute inset-0">
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: `${CONTENT_WIDTH}px`,
          height: `${CONTENT_HEIGHT}px`,
          transformOrigin: "0 0",
          transform: screenTransform,
          background: "var(--bg)",
          // Black bezel hiding the seam between this pinned screen and the
          // monitor's screen opening — see @/lib/room/bezel. Tune live with the
          // ?bezel URL param.
          boxShadow: bezelBoxShadow(bezel),
          borderRadius: `${bezel.radius}px`,
          // backdrop-filter doesn't composite reliably under this matrix3d
          // ancestor, so this subtree swaps true glass for the opaque
          // "fake glass" surface. The fullscreen fallback desktop keeps real blur.
          ["--surface-bg" as string]: "var(--glass-fallback-bg)",
          ["--surface-blur" as string]: "none",
        }}
        className="pointer-events-auto relative overflow-hidden"
      >
        <OSDesktop />
      </div>

      {/* Party glow riding the same corner-pin transform as the screen, so the
          black bezel catches the party light (screen-blends a faint colored
          rim onto the frame) while party mode is on. */}
      <div
        aria-hidden="true"
        className={`${overlayStyles.bezelGlow} ${party ? overlayStyles.bezelGlowOn : ""}`}
        style={{
          width: `${CONTENT_WIDTH}px`,
          height: `${CONTENT_HEIGHT}px`,
          transformOrigin: "0 0",
          transform: screenTransform,
          borderRadius: `${bezel.radius}px`,
        }}
      />
    </div>
  );
}

// DOM loader shown over the Canvas while the GLB + HDRI stream in. Lives
// outside the Canvas (plain DOM) and reads drei's global loading progress.
// Sits on the themed dark background so the pre-paint frame matches the scene.
function RoomLoader() {
  const { active, progress } = useProgress();
  if (!active) return null;
  return (
    <div
      className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-4"
      style={{ background: "var(--bg)", color: "var(--fg)" }}
      role="status"
      aria-live="polite"
    >
      <span className="text-[15px] font-medium text-[var(--fg-muted)]">
        Loading the room… {Math.round(progress)}%
      </span>
      <div className="h-1 w-48 overflow-hidden rounded-full bg-[var(--glass-border)]">
        <div
          className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

/**
 * The office.glb scene, rendered live via react-three-fiber under a real
 * HDRI from a single, fully static locked camera angle, with the shared
 * OSDesktop corner-pinned onto the monitor's screen. Promoted to the primary
 * experience — RoomExperience mounts this when WebGL is available and motion
 * isn't reduced, and falls back to the fullscreen desktop otherwise.
 */
export default function RoomScene3D() {
  const [journalOpen, setJournalOpen] = useState(false);
  const [guitarOpen, setGuitarOpen] = useState(false);
  const [stickyOpen, setStickyOpen] = useState(false);
  const overlayOpen = journalOpen || guitarOpen || stickyOpen;

  // Sticky-note glow/hover outline — normally the baked-in NOTEPAD_SHAPE, but
  // re-traceable (and shown magenta) via the pen tool when the URL has ?tune.
  // Read once on mount to avoid useSearchParams' Suspense requirement.
  const [notepadShape, setNotepadShape] = useState<NotepadShape>(NOTEPAD_SHAPE);
  const [tuning, setTuning] = useState(false);
  // Live screen-bezel tuning, gated behind ?bezel (independent of the pen tool).
  const [bezel, setBezel] = useState<Bezel>(DEFAULT_BEZEL);
  const [tuningBezel, setTuningBezel] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTuning(params.has("tune"));
    setTuningBezel(params.has("bezel"));
  }, []);

  return (
    <div className="relative h-screen w-screen" style={{ background: "var(--bg)" }}>
      {/* `inert` while an overlay is open removes the room from tab order and AT
          exposure without unmounting it — same rendering, no dangling focus targets underneath
          a modal. */}
      <div className="contents" inert={overlayOpen}>
        <Canvas camera={{ position: CAMERA_POSITION, fov: FOV }}>
          {/* Environment (HDRI) lives inside the same Suspense boundary as the GLB so the
              loader waits for both assets — otherwise the scene can flash lit-but-empty or
              unlit mid-load. */}
          <Suspense fallback={null}>
            <Environment files="/hdri/venice_sunset_1k.hdr" />
            <OfficeScene
              journalOpen={journalOpen}
              onOpenJournal={() => setJournalOpen(true)}
              guitarOpen={guitarOpen}
              onOpenGuitar={() => setGuitarOpen(true)}
              stickyOpen={stickyOpen}
              onOpenSticky={() => setStickyOpen(true)}
              notepadShape={notepadShape}
              debugBox={tuning}
            />
          </Suspense>

          <PartyLights />
          <StaticCamera />
        </Canvas>

        <MonitorScreenOverlay bezel={bezel} />
      </div>

      <RoomLoader />

      {tuning ? (
        <PenTool
          value={notepadShape}
          onChange={setNotepadShape}
          onReset={() => setNotepadShape(NOTEPAD_SHAPE)}
        />
      ) : null}

      {tuningBezel ? (
        <BezelTuner value={bezel} onChange={setBezel} onReset={() => setBezel(DEFAULT_BEZEL)} />
      ) : null}

      <GuestbookOverlay open={journalOpen} onClose={() => setJournalOpen(false)} />
      <GuitarOverlay open={guitarOpen} onClose={() => setGuitarOpen(false)} />
      <StickyNoteOverlay open={stickyOpen} onClose={() => setStickyOpen(false)} />
    </div>
  );
}
