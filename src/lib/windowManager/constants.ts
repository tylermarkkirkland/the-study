import type { AppType } from "./windowReducer";

export const Z_INDEX_BASE = 10;

type DefaultWindowSpec = {
  size: { width: number; height: number };
  position: { x: number; y: number };
};

export const DEFAULT_WINDOW_SPECS: Record<AppType, DefaultWindowSpec> = {
  about: { size: { width: 420, height: 320 }, position: { x: 80, y: 60 } },
  projects: { size: { width: 520, height: 380 }, position: { x: 140, y: 90 } },
  notebook: { size: { width: 460, height: 400 }, position: { x: 200, y: 70 } },
  resume: { size: { width: 480, height: 420 }, position: { x: 120, y: 110 } },
  trash: { size: { width: 380, height: 300 }, position: { x: 260, y: 130 } },
};

export const CASCADE_OFFSET = 28;
