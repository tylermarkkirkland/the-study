"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  addSignature,
  getSignatures,
  MARKER_COLORS,
  pageCount,
  signatureBounds,
  type Signature,
  type Stroke,
} from "@/lib/guestbook/guestbookStore";
import { markFound } from "@/lib/discovery/discoveryStore";
import { DURATION, EASE_OUT } from "@/lib/motion/easings";
import styles from "./GuestbookOverlay.module.css";

type GuestbookOverlayProps = {
  open: boolean;
  onClose: () => void;
};

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

// Renders one page's ink: committed signatures plus the visitor's in-progress
// draft. Strokes are normalized 0..1; smoothing via quadratic midpoints so
// marker lines feel hand-drawn, not polyline-y.
function drawPage(
  canvas: HTMLCanvasElement,
  committed: Signature[],
  draft: Stroke[],
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
  }
  const w = rect.width;
  const h = rect.height;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const drawStroke = (stroke: Stroke) => {
    if (stroke.points.length < 2) return;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    const pts = stroke.points;
    ctx.moveTo(pts[0].x * w, pts[0].y * h);
    for (let i = 1; i < pts.length - 1; i++) {
      const midX = ((pts[i].x + pts[i + 1].x) / 2) * w;
      const midY = ((pts[i].y + pts[i + 1].y) / 2) * h;
      ctx.quadraticCurveTo(pts[i].x * w, pts[i].y * h, midX, midY);
    }
    const last = pts[pts.length - 1];
    ctx.lineTo(last.x * w, last.y * h);
    ctx.stroke();
  };

  for (const signature of committed) {
    signature.strokes.forEach(drawStroke);
    if (signature.text) {
      ctx.fillStyle = signature.text.color;
      ctx.font = `italic 600 ${Math.max(16, h * 0.055)}px "Bradley Hand", "Segoe Script", cursive`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(signature.text.value, signature.text.x * w, signature.text.y * h);
    }
  }
  draft.forEach(drawStroke);
}

type JournalPageProps = {
  pageIndex: number;
  side: "left" | "right";
  signatures: Signature[];
  draft: Stroke[];
  color: string;
  onStrokeCommit: (pageIndex: number, stroke: Stroke) => void;
};

function JournalPage({ pageIndex, side, signatures, draft, color, onStrokeCommit }: JournalPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeStroke = useRef<Stroke | null>(null);
  // Live in-progress points bump this to trigger redraws without re-rendering
  // the whole overlay per pointermove.
  const [, setTick] = useState(0);

  const committed = useMemo(
    () => signatures.filter((s) => s.page === pageIndex),
    [signatures, pageIndex],
  );

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawPage(canvas, committed, activeStroke.current ? [...draft, activeStroke.current] : draft);
  }, [committed, draft]);

  useEffect(() => {
    redraw();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(redraw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [redraw]);

  const toNorm = (event: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  };

  const handlePointerDown = (event: React.PointerEvent) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    activeStroke.current = { color, points: [toNorm(event)] };
    setTick((t) => t + 1);
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    const stroke = activeStroke.current;
    if (!stroke) return;
    const p = toNorm(event);
    const last = stroke.points[stroke.points.length - 1];
    // Skip sub-pixel jitter; keeps stored JSON small.
    if (Math.hypot(p.x - last.x, p.y - last.y) < 0.004) return;
    stroke.points.push(p);
    redraw();
  };

  const handlePointerUp = () => {
    const stroke = activeStroke.current;
    activeStroke.current = null;
    if (stroke && stroke.points.length > 1) {
      onStrokeCommit(pageIndex, stroke);
    } else {
      redraw(); // discard a stray tap
    }
  };

  return (
    <div className={`${styles.page} ${side === "left" ? styles.pageLeft : styles.pageRight}`}>
      <canvas
        ref={canvasRef}
        className={styles.pageCanvas}
        aria-label={`Journal page ${pageIndex + 1}. Draw here with the pointer to sign.`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
      {/* Hover/click targets for signatures linked to an X profile. */}
      {committed
        .filter((s) => s.xHandle)
        .map((s) => {
          const b = signatureBounds(s);
          return (
            <a
              key={s.id}
              href={`https://x.com/${s.xHandle}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.signatureLink}
              style={{
                left: `${(b.x - 0.015) * 100}%`,
                top: `${(b.y - 0.02) * 100}%`,
                width: `${(b.w + 0.03) * 100}%`,
                height: `${(b.h + 0.04) * 100}%`,
              }}
              aria-label={`Open @${s.xHandle} on X`}
            >
              <span className={styles.handleTag} aria-hidden="true">
                @{s.xHandle}
              </span>
            </a>
          );
        })}
      <span className={styles.pageNumber}>{pageIndex + 1}</span>
    </div>
  );
}

// The book on the desk: an opened journal of shared pages. Pick a marker,
// sign anywhere with the pointer, optionally link your mark to your X
// profile. Arrows flip through everyone else's spreads.
export default function GuestbookOverlay({ open, onClose }: GuestbookOverlayProps) {
  // The panel is its own component so each opening mounts it fresh: state
  // (current spread, drafts, form fields) lazily initializes from storage
  // instead of syncing via effects.
  return <AnimatePresence>{open ? <GuestbookPanel onClose={onClose} /> : null}</AnimatePresence>;
}

function GuestbookPanel({ onClose }: { onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const [entriesVersion, setEntriesVersion] = useState(0);
  const signatures = useMemo<Signature[]>(() => {
    void entriesVersion; // referenced so the version bump invalidates the memo
    return getSignatures();
  }, [entriesVersion]);

  const totalPages = pageCount(signatures);
  const totalSpreads = Math.ceil(totalPages / 2);
  // Open the book to its freshest spread — where the blank space is.
  const [spread, setSpread] = useState(() => Math.ceil(pageCount(getSignatures()) / 2) - 1);
  const leftPage = spread * 2;
  const rightPage = leftPage + 1;

  const [color, setColor] = useState(MARKER_COLORS[0].value);
  const [draftByPage, setDraftByPage] = useState<Record<number, Stroke[]>>({});
  const [xHandle, setXHandle] = useState("");
  const [typedName, setTypedName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [justSigned, setJustSigned] = useState(false);

  const hasDraft = Object.values(draftByPage).some((strokes) => strokes.length > 0);

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previouslyFocused.current?.focus();
    };
  }, [onClose]);

  const commitStroke = useCallback((pageIndex: number, stroke: Stroke) => {
    setDraftByPage((prev) => ({
      ...prev,
      [pageIndex]: [...(prev[pageIndex] ?? []), stroke],
    }));
    setJustSigned(false);
  }, []);

  const undoStroke = () => {
    setDraftByPage((prev) => {
      // Undo the most recent stroke across the whole draft.
      let latestPage = -1;
      let latestIndex = -1;
      for (const [pageStr, strokes] of Object.entries(prev)) {
        if (strokes.length > 0) {
          latestPage = Number(pageStr);
          latestIndex = strokes.length - 1;
        }
      }
      if (latestPage < 0) return prev;
      return { ...prev, [latestPage]: prev[latestPage].slice(0, latestIndex) };
    });
  };

  const clearDraft = () => setDraftByPage({});

  const handleSave = () => {
    setError(null);

    const inkedPages = Object.entries(draftByPage).filter(([, strokes]) => strokes.length > 0);
    const handle = xHandle || undefined;
    let savedAny = false;

    if (inkedPages.length === 0 && typedName.trim()) {
      // Keyboard fallback: place the typed name in open space on the emptier
      // visible page (semi-random so repeat signers don't stack exactly).
      const leftCount = signatures.filter((s) => s.page === leftPage).length;
      const page = leftCount <= signatures.filter((s) => s.page === rightPage).length ? leftPage : rightPage;
      const result = addSignature({
        page,
        strokes: [],
        text: { value: typedName, x: 0.25 + Math.random() * 0.5, y: 0.15 + Math.random() * 0.65, color },
        xHandle: handle,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      savedAny = true;
    } else {
      for (const [pageStr, strokes] of inkedPages) {
        const result = addSignature({ page: Number(pageStr), strokes, xHandle: handle });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        savedAny = true;
      }
    }

    if (!savedAny) {
      setError("Draw your name first — or type it in the field below.");
      return;
    }

    markFound("guestbook-sign");
    setEntriesVersion((v) => v + 1);
    setDraftByPage({});
    setXHandle("");
    setTypedName("");
    setJustSigned(true);
  };

  return (
    <motion.div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: DURATION.base, ease: EASE_OUT }}
          onClick={onClose}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="guestbook-overlay-title"
            className="relative flex max-h-[92vh] w-full max-w-3xl flex-col gap-3 overflow-y-auto rounded-[var(--radius-window)] border border-[var(--glass-border)] bg-[var(--surface-bg)] p-6 text-[var(--fg)] shadow-[var(--glass-shadow)] backdrop-blur-[var(--glass-blur)]"
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: DURATION.base, ease: EASE_OUT }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label="Close guestbook"
              className="absolute top-3 right-3 z-10 flex h-11 w-11 items-center justify-center rounded-full text-xl text-[var(--fg-muted)] hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              ×
            </button>

            <div>
              <h2 id="guestbook-overlay-title" className="pr-12 text-2xl font-semibold tracking-tight">
                Guestbook
              </h2>
              <p className="mt-0.5 text-[14px] text-[var(--fg-muted)]">
                Pick a marker and sign anywhere there&apos;s space. Hover a signature to see who left it.
              </p>
            </div>

            {/* The open book */}
            <div className={styles.book}>
              <JournalPage
                pageIndex={leftPage}
                side="left"
                signatures={signatures}
                draft={draftByPage[leftPage] ?? []}
                color={color}
                onStrokeCommit={commitStroke}
              />
              <JournalPage
                pageIndex={rightPage}
                side="right"
                signatures={signatures}
                draft={draftByPage[rightPage] ?? []}
                color={color}
                onStrokeCommit={commitStroke}
              />
            </div>

            {/* Page navigation */}
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => setSpread((s) => Math.max(0, s - 1))}
                disabled={spread === 0}
                aria-label="Previous pages"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--glass-border)] text-lg hover:bg-white/10 disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                ←
              </button>
              <span className="min-w-32 text-center text-[13px] text-[var(--fg-muted)]" aria-live="polite">
                Pages {leftPage + 1}–{rightPage + 1} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setSpread((s) => Math.min(totalSpreads - 1, s + 1))}
                disabled={spread >= totalSpreads - 1}
                aria-label="Next pages"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--glass-border)] text-lg hover:bg-white/10 disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                →
              </button>
            </div>

            {/* Marker + actions toolbar */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2" role="radiogroup" aria-label="Marker color">
                {MARKER_COLORS.map((marker) => (
                  <button
                    key={marker.value}
                    type="button"
                    role="radio"
                    aria-checked={color === marker.value}
                    aria-label={`${marker.name} marker`}
                    onClick={() => setColor(marker.value)}
                    className={`${styles.swatch} ${color === marker.value ? styles.swatchSelected : ""}`}
                    style={{ background: marker.value }}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={undoStroke}
                  disabled={!hasDraft}
                  className="min-h-11 rounded-lg border border-[var(--glass-border)] px-4 text-[14px] hover:bg-white/10 disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                >
                  Undo
                </button>
                <button
                  type="button"
                  onClick={clearDraft}
                  disabled={!hasDraft}
                  className="min-h-11 rounded-lg border border-[var(--glass-border)] px-4 text-[14px] hover:bg-white/10 disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Link + save row */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex min-w-40 flex-1 flex-col gap-1">
                <label htmlFor="gb-handle" className="text-[13px] font-medium text-[var(--fg-muted)]">
                  Link your X profile (optional)
                </label>
                <input
                  id="gb-handle"
                  type="text"
                  maxLength={16}
                  value={xHandle}
                  onChange={(e) => setXHandle(e.target.value)}
                  placeholder="@you"
                  className="min-h-11 rounded-lg border border-[var(--glass-border)] bg-white/5 px-3 text-[15px] text-[var(--fg)] outline-none placeholder:text-[var(--fg-muted)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                />
              </div>
              <div className="flex min-w-40 flex-1 flex-col gap-1">
                <label htmlFor="gb-typed-name" className="text-[13px] font-medium text-[var(--fg-muted)]">
                  No mouse? Type your name instead
                </label>
                <input
                  id="gb-typed-name"
                  type="text"
                  maxLength={40}
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                  className="min-h-11 rounded-lg border border-[var(--glass-border)] bg-white/5 px-3 text-[15px] text-[var(--fg)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                />
              </div>
              <button
                type="button"
                onClick={handleSave}
                className="min-h-11 rounded-lg bg-[var(--accent)] px-5 text-[15px] font-medium text-[var(--accent-fg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                Sign the book
              </button>
            </div>

            {error ? (
              <p role="alert" className="text-[14px]" style={{ color: "var(--tl-close)" }}>
                {error}
              </p>
            ) : null}
            {justSigned && !error ? (
              <p role="status" className="text-[14px]" style={{ color: "var(--tl-zoom)" }}>
                Inked. You&apos;re part of the desk now.
              </p>
            ) : null}
          </motion.div>
    </motion.div>
  );
}
