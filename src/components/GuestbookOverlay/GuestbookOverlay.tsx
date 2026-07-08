"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  clearMySignature,
  eraseAt,
  getMyId,
  getMySignature,
  getSignatures,
  MARKER_COLORS,
  pageCount,
  saveMySignature,
  signatureBounds,
  translateSignature,
  type Point,
  type Signature,
  type SignatureText,
  type Stroke,
} from "@/lib/guestbook/guestbookStore";
import { markFound } from "@/lib/discovery/discoveryStore";
import { DURATION, EASE_OUT } from "@/lib/motion/easings";
import styles from "./GuestbookOverlay.module.css";

type GuestbookOverlayProps = {
  open: boolean;
  onClose: () => void;
};

type Tool = "marker" | "eraser" | "move";
const ERASER_RADIUS = 0.035;

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

// Paints one page: others' committed ink first, then (on my page) my live
// editable ink + text. Strokes are normalized 0..1; quadratic-midpoint
// smoothing keeps marker lines from looking like polylines.
function paint(
  canvas: HTMLCanvasElement,
  others: Signature[],
  mine: { strokes: Stroke[]; text: SignatureText | null } | null,
  activeStroke: Stroke | null,
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

  const drawText = (t: SignatureText) => {
    ctx.fillStyle = t.color;
    ctx.font = `italic 600 ${Math.max(16, h * 0.055)}px "Bradley Hand", "Segoe Script", cursive`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(t.value, t.x * w, t.y * h);
  };

  for (const s of others) {
    s.strokes.forEach(drawStroke);
    if (s.text) drawText(s.text);
  }
  if (mine) {
    mine.strokes.forEach(drawStroke);
    if (activeStroke) drawStroke(activeStroke);
    if (mine.text) drawText(mine.text);
  }
}

type JournalPageProps = {
  pageIndex: number;
  side: "left" | "right";
  others: Signature[];
  mine: { strokes: Stroke[]; text: SignatureText | null } | null;
  editable: boolean;
  tool: Tool;
  color: string;
  onCommitStroke: (pageIndex: number, stroke: Stroke) => void;
  onErase: (pageIndex: number, point: Point) => void;
  onMoveBy: (dx: number, dy: number) => void;
};

function JournalPage({
  pageIndex,
  side,
  others,
  mine,
  editable,
  tool,
  color,
  onCommitStroke,
  onErase,
  onMoveBy,
}: JournalPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeStroke = useRef<Stroke | null>(null);
  const lastMove = useRef<Point | null>(null);
  const [, setTick] = useState(0);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    paint(canvas, others, mine, activeStroke.current);
  }, [others, mine]);

  useEffect(() => {
    redraw();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(redraw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [redraw]);

  const toNorm = (event: React.PointerEvent): Point => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  };

  const handlePointerDown = (event: React.PointerEvent) => {
    if (!editable) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const p = toNorm(event);
    if (tool === "marker") {
      activeStroke.current = { color, points: [p] };
      setTick((t) => t + 1);
    } else if (tool === "eraser") {
      onErase(pageIndex, p);
    } else {
      lastMove.current = p;
    }
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    if (!editable) return;
    const p = toNorm(event);
    if (tool === "marker") {
      const stroke = activeStroke.current;
      if (!stroke) return;
      const last = stroke.points[stroke.points.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) < 0.004) return; // drop jitter
      stroke.points.push(p);
      redraw();
    } else if (tool === "eraser") {
      // Only erase while the pointer is held (a button is pressed).
      if (event.buttons === 0) return;
      onErase(pageIndex, p);
    } else {
      if (!lastMove.current) return;
      onMoveBy(p.x - lastMove.current.x, p.y - lastMove.current.y);
      lastMove.current = p;
    }
  };

  const handlePointerUp = () => {
    lastMove.current = null;
    const stroke = activeStroke.current;
    activeStroke.current = null;
    if (stroke && stroke.points.length > 1) onCommitStroke(pageIndex, stroke);
    else redraw();
  };

  const cursor =
    !editable ? "default" : tool === "move" ? "grab" : tool === "eraser" ? "cell" : "crosshair";

  return (
    <div className={`${styles.page} ${side === "left" ? styles.pageLeft : styles.pageRight}`}>
      <canvas
        ref={canvasRef}
        className={styles.pageCanvas}
        style={{ cursor }}
        aria-label={`Journal page ${pageIndex + 1}${editable ? ". Draw here with the pointer to sign." : ""}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
      {/* Others' linked signatures: hover shows a tooltip, click opens X. */}
      {others
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
              aria-label={`Open @${s.xHandle} on X in a new tab`}
            >
              <span className={styles.tooltip} aria-hidden="true">
                <span className={styles.tooltipHandle}>@{s.xHandle}</span>
                <span className={styles.tooltipHint}>Open on X ↗</span>
              </span>
            </a>
          );
        })}
      <span className={styles.pageNumber}>{pageIndex + 1}</span>
    </div>
  );
}

// The book on the desk, frameless: the opened journal floating over the
// dimmed room, markers beside it. You own ONE signature — draw it, rub out
// pieces with the eraser, drag it anywhere on its page, relink or clear it.
// Everyone else's marks are read-only; hover to see who, click to visit.
export default function GuestbookOverlay({ open, onClose }: GuestbookOverlayProps) {
  return <AnimatePresence>{open ? <GuestbookPanel onClose={onClose} /> : null}</AnimatePresence>;
}

function GuestbookPanel({ onClose }: { onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const [version, setVersion] = useState(0);
  const signatures = useMemo<Signature[]>(() => {
    void version;
    return getSignatures();
  }, [version]);
  const myId = useMemo(() => {
    void version;
    return getMyId();
  }, [version]);

  // My single signature is held as one editable working copy (strokes + text
  // together, so drag/erase are single atomic updates), seeded from storage so
  // reopening the book lets me keep editing it.
  const initialMine = useMemo(() => getMySignature(), []);
  const [mine, setMine] = useState<{ strokes: Stroke[]; text: SignatureText | null }>({
    strokes: initialMine?.strokes ?? [],
    text: initialMine?.text ?? null,
  });
  const [myPage, setMyPage] = useState<number | null>(initialMine?.page ?? null);
  const [color, setColor] = useState(MARKER_COLORS[0].value);
  const [xHandle, setXHandle] = useState(initialMine ? (initialMine.xHandle ? `@${initialMine.xHandle}` : "") : "");
  const [tool, setTool] = useState<Tool>("marker");
  const [typedName, setTypedName] = useState("");
  const [showTyped, setShowTyped] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const hasInk = mine.strokes.length > 0 || !!mine.text;

  const totalPages = pageCount(signatures);
  const totalSpreads = Math.ceil(totalPages / 2);
  // Open to my signature's spread if I have one, else the freshest (blank) one.
  const [spread, setSpread] = useState(() => {
    const mine = getMySignature();
    if (mine) return Math.floor(mine.page / 2);
    return Math.ceil(pageCount(getSignatures()) / 2) - 1;
  });
  const leftPage = spread * 2;
  const rightPage = leftPage + 1;

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
    setMyPage((prev) => prev ?? pageIndex); // first stroke claims a page
    setMine((prev) => ({ ...prev, strokes: [...prev.strokes, stroke] }));
    setStatus(null);
    setConfirmClear(false);
  }, []);

  const erase = useCallback((_pageIndex: number, point: Point) => {
    setMine((prev) => ({ ...prev, strokes: eraseAt(prev.strokes, point, ERASER_RADIUS) }));
  }, []);

  const moveBy = useCallback((dx: number, dy: number) => {
    setMine((prev) => translateSignature(prev.strokes, prev.text, dx, dy));
  }, []);

  const undo = () => {
    setMine((prev) => ({ ...prev, strokes: prev.strokes.slice(0, -1) }));
    setConfirmClear(false);
  };

  const clearAll = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    setMine({ strokes: [], text: null });
    setMyPage(null);
    setXHandle("");
    clearMySignature();
    setConfirmClear(false);
    setVersion((v) => v + 1);
    setStatus("Cleared. The page is yours again.");
    setError(null);
  };

  const save = () => {
    setError(null);
    let page = myPage;
    let text = mine.text;

    // Typed-name fallback: place it in open space on the visible spread.
    if (!hasInk && typedName.trim()) {
      page = leftPage;
      text = { value: typedName, x: 0.3 + Math.random() * 0.4, y: 0.3 + Math.random() * 0.4, color };
    }
    if (page === null) {
      setError("Draw your name on a page first — or type it instead.");
      return;
    }

    const result = saveMySignature({ page, strokes: mine.strokes, text: text ?? undefined, xHandle });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    // Adopt the normalized/saved copy back into the working state.
    setMine({ strokes: result.signature.strokes, text: result.signature.text ?? null });
    setMyPage(result.signature.page);
    setTypedName("");
    setShowTyped(false);
    markFound("guestbook-sign");
    setVersion((v) => v + 1);
    setStatus(
      result.signature.xHandle
        ? "Signed and linked. Others can hover your ink to find you."
        : "Signed. Add your X handle above if you'd like it linked.",
    );
  };

  // A page is editable if it's my signature's page, or (before I've drawn
  // anything) whichever page I start drawing on.
  const editablePage = (index: number) => myPage === null || myPage === index;
  const mineFor = (index: number) => (myPage === index ? mine : null);
  const othersFor = (index: number) =>
    signatures.filter((s) => s.id !== myId && s.page === index);

  const toolButton = (value: Tool, label: string, glyph: string) => (
    <button
      type="button"
      onClick={() => setTool(value)}
      aria-pressed={tool === value}
      aria-label={label}
      title={label}
      className={`flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-[15px] ${
        tool === value ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "text-white/85 hover:bg-white/10"
      } focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]`}
    >
      {glyph}
    </button>
  );

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
        <button
          type="button"
          onClick={() => setSpread((s) => Math.max(0, s - 1))}
          disabled={spread === 0}
          aria-label="Previous pages"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black/40 text-lg text-white/90 hover:bg-black/60 disabled:opacity-25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          ←
        </button>

        <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
          <div className={styles.book}>
            <JournalPage
              pageIndex={leftPage}
              side="left"
              others={othersFor(leftPage)}
              mine={mineFor(leftPage)}
              editable={editablePage(leftPage)}
              tool={tool}
              color={color}
              onCommitStroke={commitStroke}
              onErase={erase}
              onMoveBy={moveBy}
            />
            <JournalPage
              pageIndex={rightPage}
              side="right"
              others={othersFor(rightPage)}
              mine={mineFor(rightPage)}
              editable={editablePage(rightPage)}
              tool={tool}
              color={color}
              onCommitStroke={commitStroke}
              onErase={erase}
              onMoveBy={moveBy}
            />
          </div>

          {/* Tool + action strip */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 rounded-2xl bg-black/45 px-3 py-1.5">
            {toolButton("marker", "Marker", "✒︎")}
            {toolButton("eraser", "Eraser", "⌫")}
            {toolButton("move", "Move signature", "✥")}
            <span className="mx-1 h-5 w-px bg-white/20" aria-hidden="true" />
            <button
              type="button"
              onClick={undo}
              disabled={mine.strokes.length === 0}
              className="min-h-9 rounded-lg px-2.5 text-[13px] text-white/85 hover:bg-white/10 disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              Undo
            </button>
            <button
              type="button"
              onClick={clearAll}
              disabled={!hasInk && !myId}
              className="min-h-9 rounded-lg px-2.5 text-[13px] text-white/85 hover:bg-white/10 disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              {confirmClear ? "Tap again to clear" : "Clear"}
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!hasInk && !typedName.trim()}
              className="min-h-9 rounded-lg bg-[var(--accent)] px-4 text-[13px] font-medium text-[var(--accent-fg)] disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              {myId ? "Save changes" : "Sign the book"}
            </button>
            <span className="px-1 text-[12px] text-white/60" aria-live="polite">
              {leftPage + 1}–{rightPage + 1} / {totalPages}
            </span>
          </div>

          {/* Link + typed-name strip */}
          <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl bg-black/45 px-3 py-1.5">
            <label htmlFor="gb-handle" className="text-[13px] text-white/85">
              Link to X:
            </label>
            <input
              id="gb-handle"
              type="text"
              maxLength={16}
              value={xHandle}
              onChange={(e) => setXHandle(e.target.value)}
              placeholder="@you"
              className="min-h-9 w-28 rounded-lg border border-white/25 bg-white/10 px-2.5 text-[14px] text-white outline-none placeholder:text-white/40 focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            />
            {showTyped ? (
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
                onClick={() => setShowTyped(true)}
                className="min-h-9 rounded-lg px-2 text-[12px] text-white/60 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                No mouse? Type instead
              </button>
            )}
          </div>

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

        <button
          type="button"
          onClick={() => setSpread((s) => Math.min(totalSpreads - 1, s + 1))}
          disabled={spread >= totalSpreads - 1}
          aria-label="Next pages"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black/40 text-lg text-white/90 hover:bg-black/60 disabled:opacity-25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          →
        </button>

        {/* Marker tray */}
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
              onClick={() => {
                setColor(marker.value);
                setTool("marker");
              }}
              className={`${styles.swatch} ${color === marker.value ? styles.swatchSelected : ""}`}
              style={{ background: marker.value }}
            />
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
