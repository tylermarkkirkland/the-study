"use client";

import { createContext, useCallback, useContext, useMemo, useReducer } from "react";
import type { ReactNode } from "react";
import {
  initialWindowManagerState,
  windowReducer,
  type AppType,
  type WindowState,
} from "@/lib/windowManager/windowReducer";
import { appRegistry } from "./appRegistry";

type WindowManagerContextValue = {
  windows: WindowState[];
  openWindow: (appType: AppType, opts?: { documentId?: string; title?: string }) => void;
  closeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  restoreWindow: (id: string) => void;
  moveWindow: (id: string, position: { x: number; y: number }) => void;
  toggleMaximize: (
    id: string,
    bounds: { position: { x: number; y: number }; size: { width: number; height: number } },
  ) => void;
};

const WindowManagerContext = createContext<WindowManagerContextValue | null>(null);

export function WindowManagerProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(windowReducer, initialWindowManagerState);

  const openWindow = useCallback(
    (appType: AppType, opts?: { documentId?: string; title?: string }) => {
      dispatch({
        type: "OPEN_WINDOW",
        appType,
        title: opts?.title ?? appRegistry[appType].title,
        documentId: opts?.documentId,
      });
    },
    [],
  );

  const closeWindow = useCallback((id: string) => {
    dispatch({ type: "CLOSE_WINDOW", id });
  }, []);

  const focusWindow = useCallback((id: string) => {
    dispatch({ type: "FOCUS_WINDOW", id });
  }, []);

  const minimizeWindow = useCallback((id: string) => {
    dispatch({ type: "MINIMIZE_WINDOW", id });
  }, []);

  const restoreWindow = useCallback((id: string) => {
    dispatch({ type: "RESTORE_WINDOW", id });
  }, []);

  const moveWindow = useCallback((id: string, position: { x: number; y: number }) => {
    dispatch({ type: "MOVE_WINDOW", id, position });
  }, []);

  const toggleMaximize = useCallback(
    (
      id: string,
      bounds: { position: { x: number; y: number }; size: { width: number; height: number } },
    ) => {
      dispatch({ type: "TOGGLE_MAXIMIZE", id, bounds });
    },
    [],
  );

  const value = useMemo(
    () => ({
      windows: state.windows,
      openWindow,
      closeWindow,
      focusWindow,
      minimizeWindow,
      restoreWindow,
      moveWindow,
      toggleMaximize,
    }),
    [
      state.windows,
      openWindow,
      closeWindow,
      focusWindow,
      minimizeWindow,
      restoreWindow,
      moveWindow,
      toggleMaximize,
    ]
  );

  return (
    <WindowManagerContext.Provider value={value}>
      {children}
    </WindowManagerContext.Provider>
  );
}

export function useWindowManager() {
  const context = useContext(WindowManagerContext);
  if (!context) {
    throw new Error("useWindowManager must be used within a WindowManagerProvider");
  }
  return context;
}
