"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDiscoveries } from "@/lib/discovery/discoveryStore";
import { discoveries } from "@/data/discoveries";

const TOTAL = discoveries.length;

// Festive palette — the OS traffic-light + accent colors plus a few brights.
const COLORS = [
  "#ff5f57", "#febc2e", "#28c840", "#0a84ff",
  "#ff2d55", "#ffd60a", "#bf5af2", "#64d2ff",
];

const EMIT_MS = 3500; // keep launching new confetti this long (a continuous
// shower), then let the last pieces fall out — roughly doubles the total length
const SPAWN_PER_SEC = 65; // emission rate → steady on-screen density
const GRAVITY = 0.22; // gentle, so it flutters rather than plummets
const MAX_FALL = 7; // terminal velocity (px/frame)
const DRAG = 0.99;
const SWAY = 0.9; // horizontal flutter amplitude
const MAX_MS = 8000; // safety hard-stop even if a stray particle lingers

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vrot: number;
  phase: number;
  color: string;
  round: boolean;
};

// Rains confetti down from the top of the screen when the last discovery is
// found. Lives inside OSDesktop (for the discovery store) but portals to
// document.body so it covers the whole room, not the monitor. The canvas never
// intercepts input (pointer-events: none) and animation is skipped for
// prefers-reduced-motion. The finale SOUND is handled in the discovery store;
// this component is purely the visual.
export default function CompletionConfetti() {
  const found = useDiscoveries();
  const [mounted, setMounted] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  // null on first render → captured as a baseline so returning visitors who load
  // already-complete don't get a burst; only an in-session completion fires it.
  const wasCompleteRef = useRef<boolean | null>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const complete = found.size >= TOTAL;
    if (wasCompleteRef.current === null) {
      wasCompleteRef.current = complete;
      return;
    }
    if (complete && !wasCompleteRef.current) {
      fireConfetti(canvasRef.current, rafRef);
    }
    wasCompleteRef.current = complete;
  }, [found]);

  // Stop any in-flight animation if the component unmounts mid-burst. Reading
  // rafRef.current in cleanup is intentional — we want to cancel whatever frame
  // is pending at unmount, not the (null) value captured at mount.
  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 h-full w-full"
      style={{ zIndex: 2147483001 }}
    />,
    document.body,
  );
}

function fireConfetti(
  canvas: HTMLCanvasElement | null,
  rafRef: { current: number | null },
): void {
  if (!canvas) return;

  // Honor reduced-motion: no particle storm. (The finale sound still plays.)
  if (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // A continuous shower: keep spawning pieces just above the top edge for
  // EMIT_MS so the on-screen density holds steady, then let the stragglers fall
  // out. Same look at any instant as a single burst — it just lasts longer.
  const particles: Particle[] = [];
  const spawnOne = () => {
    particles.push({
      x: Math.random() * w,
      y: -20 - Math.random() * 40,
      vx: (Math.random() - 0.5) * 3,
      vy: 2 + Math.random() * 3,
      size: 6 + Math.random() * 6,
      rot: Math.random() * Math.PI,
      vrot: (Math.random() - 0.5) * 0.3,
      phase: Math.random() * Math.PI * 2,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      round: Math.random() < 0.35,
    });
  };

  const startTs = performance.now();
  let lastTs = startTs;
  let spawnCarry = 0;

  const tick = (now: number) => {
    const dt = Math.min(now - lastTs, 50); // clamp so a background tab can't burst
    lastTs = now;
    const elapsed = now - startTs;

    // Emit at a steady rate while inside the emission window.
    if (elapsed < EMIT_MS) {
      spawnCarry += (SPAWN_PER_SEC * dt) / 1000;
      while (spawnCarry >= 1) {
        spawnOne();
        spawnCarry -= 1;
      }
    }

    ctx.clearRect(0, 0, w, h);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.vy = Math.min(MAX_FALL, p.vy + GRAVITY);
      p.vx *= DRAG;
      p.x += p.vx + Math.sin(now / 240 + p.phase) * SWAY;
      p.y += p.vy;
      p.rot += p.vrot;
      if (p.y > h + 40) {
        particles.splice(i, 1); // fell off the bottom — retire it
        continue;
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.round) {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      }
      ctx.restore();
    }

    const stillGoing = elapsed < EMIT_MS || particles.length > 0;
    if (stillGoing && elapsed < MAX_MS) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      ctx.clearRect(0, 0, w, h);
      rafRef.current = null;
    }
  };

  if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
  rafRef.current = requestAnimationFrame(tick);
}
