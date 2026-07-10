"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { desktopIcons } from "@/data/desktopIcons";

export type Pos = { x: number; y: number };

type Persisted = {
  positions: Record<string, Pos>;
  // Non-document icons the user has dragged into the Trash.
  trashed: string[];
  // Documents the user has pulled OUT of the Trash. Documents default to the
  // Trash, so we track the *inverse* — this defaults to [] (all documents
  // trashed), which means new documents automatically appear in every user's
  // Trash with no migration, and a returning user's restore choices still stick.
  restoredDocs: string[];
};

const STORAGE_KEY = "classic-os:desktop-v2";

// Ids of the document "files" (appType "document"), computed once from the
// static icon list. Used to route trash/restore through the restoredDocs model
// instead of the plain `trashed` list.
const DOCUMENT_IDS = new Set(
  desktopIcons.filter((i) => i.appType === "document").map((i) => i.id),
);

type DesktopIconsContextValue = {
  /** Pixel positions of icons on the desktop, relative to the desktop area. */
  positions: Record<string, Pos>;
  /** Ids of icons currently sitting in the Trash. */
  trashedIds: string[];
  /** Seed any icon that doesn't yet have a position, from its descriptor's %. */
  ensureSeeded: (size: { w: number; h: number }) => void;
  moveIcon: (id: string, pos: Pos) => void;
  trashIcon: (id: string) => void;
  restoreIcon: (id: string) => void;
};

const DesktopIconsContext = createContext<DesktopIconsContextValue | null>(null);

function loadInitial(): Persisted {
  if (typeof window === "undefined") return { positions: {}, trashed: [], restoredDocs: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Persisted>;
      return {
        positions: parsed.positions ?? {},
        trashed: Array.isArray(parsed.trashed) ? parsed.trashed : [],
        restoredDocs: Array.isArray(parsed.restoredDocs) ? parsed.restoredDocs : [],
      };
    }
  } catch {
    // Corrupt/absent storage — fall through to defaults.
  }
  return { positions: {}, trashed: [], restoredDocs: [] };
}

export function DesktopIconsProvider({ children }: { children: ReactNode }) {
  // Lazy initializer (not an effect) reads storage on the client without a
  // hydration mismatch: the grid only renders icons after it measures its size
  // (client-only), so the server's empty first render is never compared against
  // populated icons.
  const [state, setState] = useState<Persisted>(loadInitial);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage failures (private mode, quota).
    }
  }, [state]);

  const ensureSeeded = useCallback((size: { w: number; h: number }) => {
    setState((prev) => {
      let changed = false;
      const positions = { ...prev.positions };
      for (const icon of desktopIcons) {
        if (!positions[icon.id]) {
          positions[icon.id] = {
            x: (parseFloat(icon.position.left) / 100) * size.w,
            y: (parseFloat(icon.position.top) / 100) * size.h,
          };
          changed = true;
        }
      }
      return changed ? { ...prev, positions } : prev;
    });
  }, []);

  const moveIcon = useCallback((id: string, pos: Pos) => {
    setState((prev) => ({ ...prev, positions: { ...prev.positions, [id]: pos } }));
  }, []);

  // Move an icon into the Trash. Documents are tracked by their inverse
  // (restoredDocs), so trashing one means "no longer restored".
  const trashIcon = useCallback((id: string) => {
    setState((prev) => {
      if (DOCUMENT_IDS.has(id)) {
        return { ...prev, restoredDocs: prev.restoredDocs.filter((d) => d !== id) };
      }
      return prev.trashed.includes(id) ? prev : { ...prev, trashed: [...prev.trashed, id] };
    });
  }, []);

  // Put an item back on the desktop. For documents that means marking them
  // restored; for normal icons it means removing them from the trashed list.
  const restoreIcon = useCallback((id: string) => {
    setState((prev) => {
      if (DOCUMENT_IDS.has(id)) {
        return prev.restoredDocs.includes(id)
          ? prev
          : { ...prev, restoredDocs: [...prev.restoredDocs, id] };
      }
      return { ...prev, trashed: prev.trashed.filter((t) => t !== id) };
    });
  }, []);

  // Everything currently in the Trash: the user-trashed normal icons, plus every
  // document that hasn't been restored (documents default to the Trash).
  const trashedIds = useMemo(() => {
    const docsInTrash = [...DOCUMENT_IDS].filter((id) => !state.restoredDocs.includes(id));
    return [...state.trashed, ...docsInTrash];
  }, [state.trashed, state.restoredDocs]);

  const value = useMemo(
    () => ({
      positions: state.positions,
      trashedIds,
      ensureSeeded,
      moveIcon,
      trashIcon,
      restoreIcon,
    }),
    [state.positions, trashedIds, ensureSeeded, moveIcon, trashIcon, restoreIcon],
  );

  return (
    <DesktopIconsContext.Provider value={value}>{children}</DesktopIconsContext.Provider>
  );
}

export function useDesktopIcons() {
  const context = useContext(DesktopIconsContext);
  if (!context) {
    throw new Error("useDesktopIcons must be used within a DesktopIconsProvider");
  }
  return context;
}
