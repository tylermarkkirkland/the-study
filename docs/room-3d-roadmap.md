# Room 3D Roadmap

**Status (2026-07-06):** all five phases done. The 3D room is now the **primary** experience: root `/` renders `RoomExperience`, which mounts `RoomScene3D` (renamed from `RoomScene3DTest`) when WebGL is available and motion isn't reduced, and falls back to the CSS `RoomScene` otherwise (no WebGL / reduced motion / runtime 3D error via `RoomErrorBoundary`). `useProgress`-driven loader covers GLB+HDRI streaming (Environment moved inside the Suspense boundary). `/room-3d-test` remains as a direct-mount calibration route. Alongside this, the on-screen OS was redesigned from System 7 retro to a modern macOS-glass look (dark default) — see `~/.claude/plans/we-re-working-on-the-foamy-trinket.md` for the full plan.

**Status (2026-07-02):** phases 1–3 below were done. The user's own hand-built Blender office scene (`office.glb`) is integrated and rendering with a locked camera and a calibrated screen overlay. See "Screen overlay" section below.
**Decision (2026-07-01):** the room's end goal is a realistically 3D-modeled, realistically lit scene (à la react-three-fiber + GLB + HDRI lighting) — graybox is scaffolding for the current phase, not the final look.

## Reference research

Studied https://www.prestonb.xyz/ (Vite + React SPA) via chrome-devtools-mcp for techniques. Full writeup saved to Claude memory (`prestonb_reference.md`); summary:

- The room/desk isn't CSS or a flat image — it's a real GLB 3D model (`Edited-optimized.glb`, Draco-compressed), rendered live with three.js (react-three-fiber, based on bundle splits), lit by swappable HDRI environment maps (`venice_sunset_1k.hdr` for day, `dikhololo_night_1k.hdr` for night/lamp-off). Swapping the HDRI is what relights the whole scene when the lamp toggles — real PBR, not a filter.
- A flat light/dark image pair sits underneath as a placeholder while the GLB+HDRI+three.js payload streams in, then the canvas takes over.
- Individual desk items (Mac, camera, books, plant) are flat 2D images layered on top at percentage-based positions, each with a light/dark crossfade and hover glow, clickable to open full-screen overlays.
- Clicking the Mac opens a hand-built Macintosh 128K sim done in plain HTML/CSS: pinstripe title bar (`repeating-linear-gradient`), hard 2px border + flat (non-blurred) drop shadow, dithered desktop via `repeating-conic-gradient`, monochrome-CRT tint via stacked `filter` (brightness/saturate/sepia/hue-rotate), custom SVG cursor, CRT power-on animation via animated `clip-path`. Desktop icons there are plain divs with no `role="button"` / keyboard handling — a11y gap, explicitly not to copy.
- Also used: Rive (`.riv`) for small animated widgets, Lenis for smooth scroll.

**Key implication:** the photoreal room look comes from an authored-3D-asset + real-time-PBR-rendering pipeline, not a CSS trick. The window-chrome/CRT techniques ARE cheap CSS and portable independent of the room decision.

## Current codebase state (surveyed 2026-07-01)

- `RoomScene` → `Monitor` → `Screen`/`OSDesktop` → window manager is already cleanly layered; `RoomScene` does not import from `windowManager` and vice versa. `DeskProps` are decorative placeholders with zero coupling to window state. **No refactor needed here before starting 3D work.**
- `RoomScene.module.css`: floor uses `perspective: 1400px` + `transform: rotateX(55deg)` on a `.floorWrap`/`.floor` pair — static CSS 3D, no JS.
- `WindowFrame.tsx` / `WindowTitleBar.tsx`: already has a focused-state pinstripe title bar (`repeating-linear-gradient(#8a8a8a 0px,#8a8a8a 1px,#fff 1px,#fff 3px)`) — independently close to the prestonb.xyz technique already. Frame uses `border-2 border-stone-900` + a **blurred** shadow (`shadow-[0_6px_18px_rgba(0,0,0,0.3)]`). No maximize button. No window-open animation yet.
- `MotionProvider.tsx` wires `MotionConfig reducedMotion="user"` globally — any new animation work inherits reduced-motion support for free.
- Design language: `stone-900` chrome, white backgrounds, `border-2`, Tailwind defaults, no custom theme/tokens file yet.

## Roadmap phases

1. **Boundary hardening** — done, was already satisfied. `RoomScene3DTest` (the isolated `/room-3d-test` route) still doesn't touch the live `RoomScene`/window manager.
2. **Cheap CSS window-chrome wins** — done: `WindowFrame`'s shadow is now flat/hard (`shadow-[4px_4px_0_0_theme(colors.stone.900)]`, matching `whileDrag`). Maximize button still not added (separate, undecided feature).
3. **Stand up the 3D pipeline in isolation** — done: `react-three-fiber` + `drei` + `three` installed, `/room-3d-test` route + `RoomScene3DTest` component built. A real free CC0 asset (Poly Haven `potted_plant_01`) and a real HDRI (`venice_sunset_1k`) were proven end-to-end early on, establishing the `gltf-transform optimize --compress draco --texture-compress webp --texture-size 2048` pipeline.
4. **Author or source the real 3D room** — done, via a third path not originally listed: the user hand-assembled `office.glb` in Blender themselves (metal desk, LG monitor/keyboard/mouse, chair, shelf, radio, guitar, desk clutter — a mix of Poly Haven CC0 props and Sketchfab downloads), including a `ScreenAnchor` marker plane. Exported at 519MB, optimized down to ~10.5MB with the same pipeline. Loads and renders correctly in `/room-3d-test`.
5. **Loading & fallback** — not started. Still needed before this leaves the test route: a placeholder while `office.glb` streams in, and a real non-WebGL fallback given the project's accessibility commitments.

## Screen overlay (new section — this was the bulk of session 2 effort)

Goal: put real DOM content (eventually the actual `OSDesktop`) onto the monitor's screen in the 3D scene, matching its position/shape exactly.

**What was tried, in order, and why each was replaced:**
1. Bounding-box projection (project the `ScreenAnchor` mesh's 8 corners through the camera, take the min/max as a CSS rect) — fundamentally wrong: a tilting plane projects to a trapezoid, and an axis-aligned box can't represent that, so it always looked disconnected under any tilt.
2. drei `<Html transform>` using the anchor's real exported rotation — broke differently: the `ScreenAnchor`'s rotation (a clean 90° about X) puts its normal pointing at the floor in the final glTF, not at the camera — likely a Blender Z-up vs glTF Y-up mismatch introduced somewhere in the export/rotation the user applied. Content rendered edge-on as a thin sliver.
3. `<Html transform sprite>` (pure camera-facing billboard, ignores object rotation) — fixed the sliver bug, correctly glued to the monitor under tilt (after also fixing a real stale-`matrixWorld` sync bug — `camera.lookAt()` doesn't refresh `matrixWorldInverse` until the render pass, so projection math run earlier in the frame needs an explicit `camera.updateMatrixWorld(true)`). Downside: real monitors are usually reclined a few degrees, and a pure billboard can never keystone to match that, so it never quite matched the true screen shape.
4. Tried adding a manual tilt-angle slider on top of the billboard to approximate the recline — workable but fiddly, and still constrained to "whatever a flat rotated plane can produce."
5. **Corner-pin overlay (current, working approach):** ditched the 3D-anchor tracking entirely. Four draggable DOM handles in plain 2D screen space, with a proper CSS `matrix3d` homography (Paul Heckbert's closed-form "square-to-quad" derivation) computed from wherever the user drops them — this can match *any* quad shape, not just ones a rotated flat plane can produce. See `cornersToMatrix3d()` in `RoomScene3DTest.tsx`.
6. **Tilt removed for now** (`StaticCamera` replaced `LockedTiltCamera` entirely) — it was the single biggest source of debugging pain, and turned out to be a red herring for the last alignment bug anyway (the corner-pin overlay was already fully decoupled from the camera). Simpler to get the static case exactly right first, then reintroduce a subtle tilt later as an isolated, separately-tested addition.

**Calibration process, and a real lesson learned:** remote calibration (user drags corners in their browser, reads numbers off a screenshot, pastes them) failed twice — once plausibly due to hand-transcription/rounding (fixed by adding a "Copy exact values" clipboard button), and once for a reason still not fully understood. What actually worked: doing the calibration directly via my own screenshot tool, the same iterative way the camera position and tilt amount were dialed in earlier — this hit a real tooling bug (a resized R3F canvas doesn't repaint its full WebGL viewport unless a manual `window.dispatchEvent(new Event('resize'))` is fired after `preview_resize` — otherwise only a small stale corner re-renders) — once worked around, self-calibration was fast and reliable. The user's own final "Copy exact values" output was still the one ultimately baked in, since it reflects their actual browser — self-calibration was the debugging technique, not a replacement for user-in-the-loop confirmation.

**Current state:** `CALIBRATED_CORNERS` in `RoomScene3DTest.tsx` holds the user-confirmed-working values, now **responsive** (see below). Screen content is a placeholder blue "SCREEN TEST" div.

**Responsiveness — solved (2026-07-02).** Corners are stored relative to a `REFERENCE_VIEWPORT` (the exact window size — `1536×743` — captured via an enhanced "Copy exact values" button that now includes `window.innerWidth/innerHeight` alongside the corner JSON) and rescaled live via `toDisplayCorner`/`toReferenceCorner`. The key insight that made this simple rather than requiring true 3D re-projection: with a fixed-vertical-FOV perspective camera and a static (non-orbiting) view, an already-framed object's on-screen size/position scales purely with canvas **height** — widening the window only reveals more of the room at the sides without moving what's already in frame. Verified directly (own screenshots, three different window sizes) before handing back to the user, who confirmed both static alignment and live resizing work correctly. This mechanism only holds because the camera is static — it would need to be redone if per-frame camera movement (e.g. the tilt) comes back.

## Open questions for next session

- Whether/how to reintroduce the subtle cursor tilt — the current responsive corner-pin math assumes a static camera, so bringing tilt back means either accepting the screen no longer perfectly tracks it, or moving to true per-frame 3D re-projection.
- Swapping the placeholder blue div for the real `OSDesktop` component — should be a content-only change once the overlay itself is responsive.
- `MacHero` CSS prototype's fate (keep as reference, merge into `Monitor`, or discard) — still undecided, flagged repeatedly, never resolved.
- CLAUDE.md still says "graybox everything for now" — worth updating now that phase 4 (the real room) is actually done, so future sessions don't treat graybox as the target.
