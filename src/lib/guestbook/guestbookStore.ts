// Guestbook storage, v2: signatures are freehand marker strokes drawn onto
// shared journal pages (vector points, not bitmaps — tiny to store, crisp at
// any size, and they'll sync cleanly to a real backend later). Local-first:
// this browser's localStorage. ALL access goes through getSignatures/
// addSignature, so wiring the shared backend later means reimplementing just
// these functions against a Route Handler — no UI changes.

export type Stroke = {
  color: string;
  /** Normalized page coordinates, 0..1 on both axes. */
  points: { x: number; y: number }[];
};

export type Signature = {
  id: string;
  /** Which journal page this mark lives on (0-based). */
  page: number;
  strokes: Stroke[];
  /**
   * Keyboard-accessible fallback: a typed name rendered in ink instead of
   * drawn strokes. Position is the text's center, normalized.
   */
  text?: { value: string; x: number; y: number; color: string };
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

const STORAGE_KEY = "classic-os:guestbook-v2";

export function getSignatures(): Signature[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (s): s is Signature =>
            !!s && typeof s === "object" && typeof (s as Signature).page === "number",
        );
      }
    }
  } catch {
    // Corrupt/absent storage — treat as a fresh book.
  }
  return [];
}

export type AddSignatureInput = {
  page: number;
  strokes: Stroke[];
  text?: { value: string; x: number; y: number; color: string };
  xHandle?: string;
};

export type AddSignatureResult = { ok: true; signature: Signature } | { ok: false; error: string };

export function addSignature(input: AddSignatureInput): AddSignatureResult {
  const hasInk = input.strokes.some((s) => s.points.length > 1);
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

  const signature: Signature = {
    id: `sig-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    page: input.page,
    strokes: hasInk ? input.strokes : [],
    text,
    xHandle,
    createdAt: Date.now(),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...getSignatures(), signature]));
  } catch {
    return { ok: false, error: "Couldn't save your signature — storage seems to be unavailable." };
  }
  return { ok: true, signature };
}

/** Bounding box of a signature's ink (or text anchor), normalized 0..1. */
export function signatureBounds(signature: Signature): { x: number; y: number; w: number; h: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const stroke of signature.strokes) {
    for (const p of stroke.points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }
  if (signature.text) {
    // Approximate a text box around the anchor; exact metrics don't matter
    // for a hover target.
    const halfW = Math.min(0.2, signature.text.value.length * 0.012);
    minX = Math.min(minX, signature.text.x - halfW);
    maxX = Math.max(maxX, signature.text.x + halfW);
    minY = Math.min(minY, signature.text.y - 0.04);
    maxY = Math.max(maxY, signature.text.y + 0.04);
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/**
 * Total pages to show: every signed page plus one blank page at the end,
 * so there's always fresh space to sign. Minimum one spread (2 pages).
 */
export function pageCount(signatures: Signature[]): number {
  const highest = signatures.reduce((max, s) => Math.max(max, s.page), -1);
  return Math.max(2, highest + 2);
}
