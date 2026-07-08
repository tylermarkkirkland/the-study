"use client";

import { useSyncExternalStore } from "react";

// Discovery progress as a plain module store rather than React Context, on
// purpose: markFound() gets called from inside the R3F <Canvas> (the radio
// handler lives in a separate reconciler root where DOM-tree context doesn't
// reliably reach), from windowed apps, and from room overlays. A module store
// with useSyncExternalStore works identically from all of them, and keeps the
// interactions fully decoupled — the radio doesn't know the Field Notes app
// exists; it just reports "I was played."

const STORAGE_KEY = "classic-os:discoveries-v1";

const EMPTY: ReadonlySet<string> = new Set();

function loadInitial(): ReadonlySet<string> {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return new Set(parsed.filter((v): v is string => typeof v === "string"));
      }
    }
  } catch {
    // Corrupt/absent storage — fall through to defaults.
  }
  return EMPTY;
}

// Replaced wholesale on every change so useSyncExternalStore's snapshot
// comparison (Object.is) sees updates; never mutated in place.
let found: ReadonlySet<string> = loadInitial();
const listeners = new Set<() => void>();

export function markFound(id: string) {
  if (found.has(id)) return;
  found = new Set([...found, id]);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...found]));
  } catch {
    // Ignore storage failures (private mode, quota) — session still works.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return found;
}

// Server snapshot is the stable empty set: windows (and thus Field Notes)
// only exist after client-side interaction, so no hydration mismatch.
function getServerSnapshot() {
  return EMPTY;
}

/** Reactive set of found discovery ids. */
export function useDiscoveries(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
