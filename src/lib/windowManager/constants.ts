import type { AppType } from "./windowReducer";

export const Z_INDEX_BASE = 10;

type DefaultWindowSpec = {
  size: { width: number; height: number };
  position: { x: number; y: number };
};

export const DEFAULT_WINDOW_SPECS: Record<AppType, DefaultWindowSpec> = {
  about: { size: { width: 420, height: 320 }, position: { x: 80, y: 60 } },
  notebook: { size: { width: 460, height: 400 }, position: { x: 200, y: 70 } },
  terminal: { size: { width: 520, height: 360 }, position: { x: 110, y: 40 } },
  game: { size: { width: 500, height: 405 }, position: { x: 150, y: 12 } },
  trash: { size: { width: 380, height: 300 }, position: { x: 260, y: 130 } },
  document: { size: { width: 420, height: 340 }, position: { x: 300, y: 90 } },
};

export const CASCADE_OFFSET = 28;
