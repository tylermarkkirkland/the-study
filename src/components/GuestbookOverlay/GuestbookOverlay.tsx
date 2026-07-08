"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  addSignature,
  getMyIds,
  getSignatures,
  MARKER_COLORS,
  pageCount,
  signatureBounds,
  updateSignatureHandle,
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
function drawPage(canvas: HTMLCanvasElement, committed: Signature[], draft: Stroke[]) {
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
  myIds: string[];
  selectedId: string | null;
  onSelectMine: (signature: Signature) => void;
  onStrokeCommit: (pageIndex: number, stroke: Stroke) => void;
};

function JournalPage({
  pageIndex,
  side,
  signatures,
  draft,
  color,
  myIds,
  selectedId,
  onSelectMine,
  onStrokeCommit,
}: JournalPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeStroke = useRef<Stroke | null>(null);
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

  const boundsStyle = (s: Signature) => {
    const b = signatureBounds(s);
    return {
      left: `${(b.x - 0.015) * 100}%`,
      top: `${(b.y - 0.02) * 100}%`,
      width: `${(b.w + 0.03) * 100}%`,
      height: `${(b.h + 0.04) * 100}%`,
    };
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
      {committed.map((s) => {
        const mine = myIds.includes(s.id);
        if (mine) {
          // Your own ink: click to attach/edit its X link (strip under the book).
          return (
            <button
              key={s.id}
              type="button"
              className={`${styles.signatureLink} ${selectedId === s.id ? styles.signatureSelected : ""}`}
              style={boundsStyle(s)}
              onClick={() => onSelectMine(s)}
              aria-label={
                s.xHandle
                  ? `Your signature, linked to @${s.xHandle}. Edit link.`
                  : "Your signature. Link it to your X profile."
              }
            >
              <span className={styles.handleTag} aria-hidden="true">
                {s.xHandle ? `@${s.xHandle} · edit` : "link to X?"}
              </span>
            </button>
          );
        }
        if (!s.xHandle) return null;
        // Someone else's linked ink: hover shows who, click visits them.
        return (
          <a
            key={s.id}
            href={`https://x.com/${s.xHandle}`}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.signatureLink}
            style={boundsStyle(s)}
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

// The book on the desk, frameless: just the opened journal floating over the
// dimmed room, markers resting beside it. Draw to sign; click your own ink
// afterwards to link it to your X profile.
export default function GuestbookOverlay({ open, onClose }: GuestbookOverlayProps) {
  // The panel is its own component so each opening mounts it fresh: state
  // (current spread, drafts, selection) lazily initializes from storage
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
  const myIds = useMemo(() => {
    void entriesVersion;
    return getMyIds();
  }, [entriesVersion]);

  const totalPages = pageCount(signatures);
  const totalSpreads = Math.ceil(totalPages / 2);
  // Open the book to its freshest spread — where the blank space is.
  const [spread, setSpread] = useState(() => Math.ceil(pageCount(getSignatures()) / 2) - 1);
  const leftPage = spread * 2;
  const rightPage = leftPage + 1;

  const [color, setColor] = useState(MARKER_COLORS[0].value);
  const [draftByPage, setDraftByPage] = useState<Record<number, Stroke[]>>({});
  const [typedName, setTypedName] = useState("");
  const [showTypedInput, setShowTypedInput] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  // Click-your-ink link editing: which of MY signatures is being linked.
  const [selected, setSelected] = useState<Signature | null>(null);
  const [handleDraft, setHandleDraft] = useState("");

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
    setStatus(null);
  }, []);

  const undoStroke = () => {
    setDraftByPage((prev) => {
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

  const handleSave = () => {
    setError(null);

    const inkedPages = Object.entries(draftByPage).filter(([, strokes]) => strokes.length > 0);
    let savedAny = false;

    if (inkedPages.length === 0 && typedName.trim()) {
      // Keyboard fallback: place the typed name in open space on the emptier
      // visible page (semi-random so repeat signers don't stack exactly).
      const leftCount = signatures.filter((s) => s.page === leftPage).length;
      const page =
        leftCount <= signatures.filter((s) => s.page === rightPage).length ? leftPage : rightPage;
      const result = addSignature({
        page,
        strokes: [],
        text: { value: typedName, x: 0.25 + Math.random() * 0.5, y: 0.15 + Math.random() * 0.65, color },
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      savedAny = true;
    } else {
      for (const [pageStr, strokes] of inkedPages) {
        const result = addSignature({ page: Number(pageStr), strokes });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        savedAny = true;
      }
    }

    if (!savedAny) {
      setError("Draw your name on the page first — or type it instead.");
      return;
    }

    markFound("guestbook-sign");
    setEntriesVersion((v) => v + 1);
    setDraftByPage({});
    setTypedName("");
    setShowTypedInput(false);
    setStatus("Inked. Click your signature if you'd like to link it to your X profile.");
  };

  const selectMine = (signature: Signature) => {
    setSelected(signature);
    setHandleDraft(signature.xHandle ? `@${signature.xHandle}` : "");
    setStatus(null);
    setError(null);
  };

  const saveHandle = (value: string | undefined) => {
    if (!selected) return;
    const result = updateSignatureHandle(selected.id, value);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setStatus(value ? "Linked. Visitors can now click your ink to find you." : "Link removed.");
    setSelected(null);
    setEntriesVersion((v) => v + 1);
  };

  return (
    <motion.div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="Guestbook"
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: DURATION.base, ease: EASE_OUT }}
      // Clicking the dim room (not the book or controls) closes the journal.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <button
        ref={closeButtonRef}
        type="button"
        onClick={onClose}
        aria-label="Close guestbook"
        className="absolute top-4 right-4 flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-xl text-white/80 hover:bg-black/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
      >
        ×
      </button>

      <motion.div
        className="flex w-full max-w-4xl items-center justify-center gap-3"
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: DURATION.base, ease: EASE_OUT }}
      >
        {/* Previous spread */}
        <button
          type="button"
          onClick={() => setSpread((s) => Math.max(0, s - 1))}
          disabled={spread === 0}
          aria-label="Previous pages"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black/40 text-lg text-white/90 hover:bg-black/60 disabled:opacity-25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          ←
        </button>

        {/* The book + its minimal controls */}
        <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
          <div className={styles.book}>
            <JournalPage
              pageIndex={leftPage}
              side="left"
              signatures={signatures}
              draft={draftByPage[leftPage] ?? []}
              color={color}
              myIds={myIds}
              selectedId={selected?.id ?? null}
              onSelectMine={selectMine}
              onStrokeCommit={commitStroke}
            />
            <JournalPage
              pageIndex={rightPage}
              side="right"
              signatures={signatures}
              draft={draftByPage[rightPage] ?? []}
              color={color}
              myIds={myIds}
              selectedId={selected?.id ?? null}
              onSelectMine={selectMine}
              onStrokeCommit={commitStroke}
            />
          </div>

          {selected ? (
            // Link strip: shown while one of your signatures is selected.
            <div className="flex flex-wrap items-center justify-center gap-2 rounded-full bg-black/45 px-4 py-1.5">
              <label htmlFor="gb-link-handle" className="text-[13px] text-white/85">
                Link this signature to X:
              </label>
              <input
                id="gb-link-handle"
                type="text"
                maxLength={16}
                value={handleDraft}
                onChange={(e) => setHandleDraft(e.target.value)}
                placeholder="@you"
                autoFocus
                className="min-h-9 w-32 rounded-lg border border-white/25 bg-white/10 px-2.5 text-[14px] text-white outline-none placeholder:text-white/40 focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              />
              <button
                type="button"
                onClick={() => saveHandle(handleDraft)}
                className="min-h-9 rounded-lg bg-[var(--accent)] px-3.5 text-[13px] font-medium text-[var(--accent-fg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                Save link
              </button>
              {selected.xHandle ? (
                <button
                  type="button"
                  onClick={() => saveHandle(undefined)}
                  className="min-h-9 rounded-lg px-3 text-[13px] text-white/75 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                >
                  Unlink
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="min-h-9 rounded-lg px-3 text-[13px] text-white/75 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                Cancel
              </button>
            </div>
          ) : (
            // Default strip: ink actions + page position.
            <div className="flex flex-wrap items-center justify-center gap-2 rounded-full bg-black/45 px-4 py-1.5">
              <button
                type="button"
                onClick={undoStroke}
                disabled={!hasDraft}
                className="min-h-9 rounded-lg px-3 text-[13px] text-white/85 hover:bg-white/10 disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                Undo
              </button>
              <button
                type="button"
                onClick={() => setDraftByPage({})}
                disabled={!hasDraft}
                className="min-h-9 rounded-lg px-3 text-[13px] text-white/85 hover:bg-white/10 disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!hasDraft && !typedName.trim()}
                className="min-h-9 rounded-lg bg-[var(--accent)] px-4 text-[13px] font-medium text-[var(--accent-fg)] disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                Sign the book
              </button>
              <span className="px-1 text-[12px] text-white/60" aria-live="polite">
                {leftPage + 1}–{rightPage + 1} / {totalPages}
              </span>
              {showTypedInput ? (
                <input
                  type="text"
                  maxLength={40}
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                  placeholder="Type your name"
                  aria-label="Type your name instead of drawing"
                  className="min-h-9 w-36 rounded-lg border border-white/25 bg-white/10 px-2.5 text-[14px] text-white outline-none placeholder:text-white/40 focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setShowTypedInput(true)}
                  className="min-h-9 rounded-lg px-2 text-[12px] text-white/60 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                >
                  No mouse? Type instead
                </button>
              )}
            </div>
          )}

          {error ? (
            <p role="alert" className="rounded-full bg-black/45 px-4 py-1 text-[13px]" style={{ color: "#ff8a80" }}>
              {error}
            </p>
          ) : null}
          {status && !error ? (
            <p role="status" className="rounded-full bg-black/45 px-4 py-1 text-[13px]" style={{ color: "#7ee6a1" }}>
              {status}
            </p>
          ) : null}
        </div>

        {/* Next spread */}
        <button
          type="button"
          onClick={() => setSpread((s) => Math.min(totalSpreads - 1, s + 1))}
          disabled={spread >= totalSpreads - 1}
          aria-label="Next pages"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black/40 text-lg text-white/90 hover:bg-black/60 disabled:opacity-25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          →
        </button>

        {/* Marker tray resting beside the book */}
        <div
          className="flex shrink-0 flex-col gap-2 rounded-full bg-black/45 px-2 py-3"
          role="radiogroup"
          aria-label="Marker color"
        >
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
      </motion.div>
    </motion.div>
  );
}
