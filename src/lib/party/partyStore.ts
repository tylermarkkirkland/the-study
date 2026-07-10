"use client";

import { useSyncExternalStore } from "react";

// Party-mode toggle as a plain module store (mirroring discoveryStore) rather
// than React Context — on purpose: the writer is a Terminal command (DOM tree)
// and the reader is <PartyLights> inside the react-three-fiber <Canvas>, a
// separate reconciler root where DOM-tree context doesn't reliably reach. A
// module store with useSyncExternalStore works identically from both.
//
// Deliberately NOT persisted to localStorage: party mode should not survive a
// page reload.

let on = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function setPartyMode(next: boolean) {
  if (on === next) return;
  on = next;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return on;
}

// Stable server value — the 3D room is client-only, so no hydration mismatch.
function getServerSnapshot() {
  return false;
}

/** Reactive party-mode flag. */
export function usePartyMode(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
