// Guestbook storage, v3: signatures are freehand marker strokes drawn onto
// shared journal pages (vector points, not bitmaps — tiny to store, crisp at
// any size, and they'll sync cleanly to a real backend later). Local-first:
// this browser's localStorage. ALL access goes through these functions, so
// wiring the shared backend later means reimplementing just this file — no
// UI changes.
//
// One signature per browser: you own a single mark (getMyId), which
// saveMySignature upserts and clearMySignature removes. Everyone else's
// signatures are read-only.

export type Point = { x: number; y: number };

export type Stroke = {
  color: string;
  /** Normalized spread coordinates, 0..1 across the full two-page spread. */
  points: Point[];
};

export type SignatureText = { value: string; x: number; y: number; color: string };

export type Signature = {
  id: string;
  /** Which journal spread (open two-page view) this mark lives on (0-based). */
  spread: number;
  strokes: Stroke[];
  /** Keyboard-accessible fallback: a typed name rendered in ink. */
  text?: SignatureText;
  /** X (Twitter) handle, stored without the leading @. Links the signature. */
  xHandle?: string;
  createdAt: number;
};

export const MARKER_COLORS = [
  { name: "Ink blue", value: "#1d4ed8" },
  { name: "Black", value: "#1c1917" },
  { name: "Red", value: "#dc2626" },
  { name: "Green", value: "#15803d" },
  { name: "Amber", value: "#b45309" },
  { name: "Purple", value: "#7e22ce" },
];

// v3: signatures moved from per-page to per-spread coordinates. The version
// bump abandons any older (v2) test signatures — the book starts fresh.
const STORAGE_KEY = "classic-os:guestbook-v3";
// The id of the ONE signature made from this browser — the editable one.
const MINE_KEY = "classic-os:guestbook-mine-v3";

export function getSignatures(): Signature[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (s): s is Signature =>
            !!s && typeof s === "object" && typeof (s as Signature).spread === "number",
        );
      }
    }
  } catch {
    // Corrupt/absent storage — treat as a fresh book.
  }
  return [];
}

/** The id of this browser's own signature, or null if it hasn't signed yet. */
export function getMyId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(MINE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    // Migrate the old array-of-ids form → the first is now "mine".
    if (Array.isArray(parsed)) return typeof parsed[0] === "string" ? parsed[0] : null;
    return typeof parsed === "string" ? parsed : null;
  } catch {
    return null;
  }
}

/** This browser's own signature object, if it has signed. */
export function getMySignature(): Signature | null {
  const id = getMyId();
  if (!id) return null;
  return getSignatures().find((s) => s.id === id) ?? null;
}

export type SaveSignatureInput = {
  spread: number;
  strokes: Stroke[];
  text?: SignatureText;
  xHandle?: string;
};

export type SaveSignatureResult = { ok: true; signature: Signature } | { ok: false; error: string };

/**
 * Create or update THIS browser's single signature. Enforces one-per-browser:
 * if a signature already exists it's replaced in place (same id/createdAt),
 * never duplicated.
 */
export function saveMySignature(input: SaveSignatureInput): SaveSignatureResult {
  const strokes = input.strokes.filter((s) => s.points.length > 1);
  const hasInk = strokes.length > 0;
  const text = input.text?.value.trim()
    ? { ...input.text, value: input.text.value.trim().slice(0, 40) }
    : undefined;
  if (!hasInk && !text) {
    return { ok: false, error: "Draw your name first — or type it in the field below." };
  }

  // Accept "@handle" or "handle"; store bare. X handles are 1–15 word chars.
  const xHandle = input.xHandle?.trim().replace(/^@/, "") || undefined;
  if (xHandle && !/^\w{1,15}$/.test(xHandle)) {
    return { ok: false, error: "That X handle doesn't look right — letters, numbers, and _ only." };
  }

  const existingId = getMyId();
  const existing = existingId ? getSignatures().find((s) => s.id === existingId) : null;
  const signature: Signature = {
    id: existing?.id ?? `sig-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    spread: input.spread,
    strokes,
    text,
    xHandle,
    createdAt: existing?.createdAt ?? Date.now(),
  };

  try {
    const rest = getSignatures().filter((s) => s.id !== signature.id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...rest, signature]));
    localStorage.setItem(MINE_KEY, JSON.stringify(signature.id));
  } catch {
    return { ok: false, error: "Couldn't save your signature — storage seems to be unavailable." };
  }
  return { ok: true, signature };
}

/** Erase this browser's signature entirely, freeing it to sign again. */
export function clearMySignature() {
  const id = getMyId();
  if (!id) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(getSignatures().filter((s) => s.id !== id)));
    localStorage.removeItem(MINE_KEY);
  } catch {
    // Ignore storage failures.
  }
}

/**
 * Erase ink near a point: removes stroke points within `radius` (normalized)
 * and splits each stroke into the contiguous segments that survive — so you
 * rub out pieces of a signature, not whole strokes at a time.
 */
export function eraseAt(strokes: Stroke[], point: Point, radius: number): Stroke[] {
  const result: Stroke[] = [];
  for (const stroke of strokes) {
    let run: Point[] = [];
    for (const p of stroke.points) {
      if (Math.hypot(p.x - point.x, p.y - point.y) <= radius) {
        if (run.length > 1) result.push({ color: stroke.color, points: run });
        run = [];
      } else {
        run.push(p);
      }
    }
    if (run.length > 1) result.push({ color: stroke.color, points: run });
  }
  return result;
}

/** Bounding box of ink + optional text, normalized 0..1. */
function boundsOf(strokes: Stroke[], text?: SignatureText | null): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const stroke of strokes) {
    for (const p of stroke.points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }
  if (text) {
    const halfW = Math.min(0.2, text.value.length * 0.012);
    minX = Math.min(minX, text.x - halfW);
    maxX = Math.max(maxX, text.x + halfW);
    minY = Math.min(minY, text.y - 0.04);
    maxY = Math.max(maxY, text.y + 0.04);
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function signatureBounds(signature: Signature) {
  return boundsOf(signature.strokes, signature.text);
}

/**
 * Translate ink + text by (dx, dy), clamped so the whole signature stays on
 * the page. Returns the moved copies.
 */
export function translateSignature(
  strokes: Stroke[],
  text: SignatureText | null,
  dx: number,
  dy: number,
): { strokes: Stroke[]; text: SignatureText | null } {
  const b = boundsOf(strokes, text);
  const clampedDx = Math.max(-b.x, Math.min(1 - (b.x + b.w), dx));
  const clampedDy = Math.max(-b.y, Math.min(1 - (b.y + b.h), dy));
  return {
    strokes: strokes.map((s) => ({
      color: s.color,
      points: s.points.map((p) => ({ x: p.x + clampedDx, y: p.y + clampedDy })),
    })),
    text: text ? { ...text, x: text.x + clampedDx, y: text.y + clampedDy } : null,
  };
}

/**
 * Total spreads (open two-page views) to show: every signed spread plus one
 * blank spread at the end, so there's always fresh space to sign. Minimum 4
 * spreads so the book always has room to page through.
 */
export function spreadCount(signatures: Signature[]): number {
  const highest = signatures.reduce((max, s) => Math.max(max, s.spread), -1);
  return Math.max(4, highest + 2);
}
