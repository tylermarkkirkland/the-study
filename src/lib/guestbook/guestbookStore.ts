// Guestbook storage. Local-first for now: entries live in this browser's
// localStorage. ALL storage access goes through getEntries/addEntry, so wiring
// the real shared backend later means reimplementing just these two functions
// against a Route Handler — no UI changes.

export type GuestbookEntry = {
  id: string;
  name: string;
  message?: string;
  /** X (Twitter) handle, stored without the leading @. */
  xHandle?: string;
  sticker: string;
  createdAt: number;
};

export type GuestbookInput = {
  name: string;
  message?: string;
  xHandle?: string;
  sticker: string;
};

export const NAME_MAX = 40;
export const MESSAGE_MAX = 280;

export const STICKERS = ["⭐", "🎸", "📻", "☕", "🖥️", "🌙", "🌵", "🔥"];

const STORAGE_KEY = "classic-os:guestbook-v1";

// Deliberately small and low-drama: this is a taste floor for a public wall,
// not a moderation system. The real backend gets real moderation.
const BLOCKED = ["fuck", "shit", "bitch", "cunt", "nigger", "faggot"];

function containsBlocked(text: string) {
  const lower = text.toLowerCase();
  return BLOCKED.some((word) => lower.includes(word));
}

export function getEntries(): GuestbookEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (e): e is GuestbookEntry =>
            !!e && typeof e === "object" && typeof (e as GuestbookEntry).name === "string",
        );
      }
    }
  } catch {
    // Corrupt/absent storage — treat as empty book.
  }
  return [];
}

export type AddEntryResult =
  | { ok: true; entry: GuestbookEntry }
  | { ok: false; error: string };

export function addEntry(input: GuestbookInput): AddEntryResult {
  const name = input.name.trim().slice(0, NAME_MAX);
  const message = input.message?.trim().slice(0, MESSAGE_MAX) || undefined;
  // Accept "@handle" or "handle"; store bare. X handles are 1–15 word chars.
  const xHandle = input.xHandle?.trim().replace(/^@/, "") || undefined;

  if (!name) {
    return { ok: false, error: "A name (or an alias — we don't check ID) is required." };
  }
  if (xHandle && !/^\w{1,15}$/.test(xHandle)) {
    return { ok: false, error: "That X handle doesn't look right — letters, numbers, and _ only." };
  }
  if (containsBlocked(name) || (message ? containsBlocked(message) : false)) {
    return { ok: false, error: "Let's keep the book friendly — try different wording." };
  }
  const sticker = STICKERS.includes(input.sticker) ? input.sticker : STICKERS[0];

  const entry: GuestbookEntry = {
    id: `gb-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    name,
    message,
    xHandle,
    sticker,
    createdAt: Date.now(),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([entry, ...getEntries()]));
  } catch {
    return { ok: false, error: "Couldn't save your signature — storage seems to be unavailable." };
  }
  return { ok: true, entry };
}
