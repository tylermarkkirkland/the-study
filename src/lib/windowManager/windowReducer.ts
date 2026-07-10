import { CASCADE_OFFSET, DEFAULT_WINDOW_SPECS, Z_INDEX_BASE } from "./constants";

export type AppType = "about" | "notebook" | "terminal" | "game" | "trash" | "document";

export type WindowState = {
  id: string;
  appType: AppType;
  title: string;
  // For appType "document": which document this window is showing. Also the key
  // that lets several document windows coexist (single-instance is per
  // appType+documentId), where every other app stays single-instance per type.
  documentId?: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
  isMinimized: boolean;
  // When maximized, holds the pre-maximize bounds so the green button can toggle
  // back to the previous size/position. null/undefined = not maximized.
  maximized?: {
    prevPosition: { x: number; y: number };
    prevSize: { width: number; height: number };
  } | null;
};

export type WindowManagerState = {
  windows: WindowState[];
  nextZIndex: number;
};

export type WindowManagerAction =
  | { type: "OPEN_WINDOW"; appType: AppType; title: string; documentId?: string }
  | { type: "CLOSE_WINDOW"; id: string }
  | { type: "FOCUS_WINDOW"; id: string }
  | { type: "MINIMIZE_WINDOW"; id: string }
  | { type: "RESTORE_WINDOW"; id: string }
  | { type: "MOVE_WINDOW"; id: string; position: { x: number; y: number } }
  | {
      type: "TOGGLE_MAXIMIZE";
      id: string;
      // The fill target (desktop area), used only when entering maximized state;
      // restoring reads the saved prev bounds instead.
      bounds: { position: { x: number; y: number }; size: { width: number; height: number } };
    };

export const initialWindowManagerState: WindowManagerState = {
  windows: [],
  nextZIndex: Z_INDEX_BASE,
};

function openedCountFor(windows: WindowState[], appType: AppType) {
  return windows.filter((w) => w.appType === appType).length;
}

export function windowReducer(
  state: WindowManagerState,
  action: WindowManagerAction
): WindowManagerState {
  switch (action.type) {
    case "OPEN_WINDOW": {
      const existing = state.windows.find(
        (w) => w.appType === action.appType && w.documentId === action.documentId,
      );
      if (existing) {
        return {
          ...state,
          nextZIndex: state.nextZIndex + 1,
          windows: state.windows.map((w) =>
            w.id === existing.id
              ? { ...w, isMinimized: false, zIndex: state.nextZIndex }
              : w
          ),
        };
      }

      const spec = DEFAULT_WINDOW_SPECS[action.appType];
      const cascade = openedCountFor(state.windows, action.appType) * CASCADE_OFFSET;
      const newWindow: WindowState = {
        id: `${action.appType}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        appType: action.appType,
        title: action.title,
        documentId: action.documentId,
        position: { x: spec.position.x + cascade, y: spec.position.y + cascade },
        size: spec.size,
        zIndex: state.nextZIndex,
        isMinimized: false,
      };

      return {
        windows: [...state.windows, newWindow],
        nextZIndex: state.nextZIndex + 1,
      };
    }

    case "CLOSE_WINDOW": {
      return {
        ...state,
        windows: state.windows.filter((w) => w.id !== action.id),
      };
    }

    case "FOCUS_WINDOW": {
      return {
        ...state,
        nextZIndex: state.nextZIndex + 1,
        windows: state.windows.map((w) =>
          w.id === action.id ? { ...w, zIndex: state.nextZIndex } : w
        ),
      };
    }

    case "MINIMIZE_WINDOW": {
      return {
        ...state,
        windows: state.windows.map((w) =>
          w.id === action.id ? { ...w, isMinimized: true } : w
        ),
      };
    }

    case "RESTORE_WINDOW": {
      return {
        ...state,
        nextZIndex: state.nextZIndex + 1,
        windows: state.windows.map((w) =>
          w.id === action.id
            ? { ...w, isMinimized: false, zIndex: state.nextZIndex }
            : w
        ),
      };
    }

    case "MOVE_WINDOW": {
      return {
        ...state,
        windows: state.windows.map((w) =>
          w.id === action.id ? { ...w, position: action.position } : w
        ),
      };
    }

    case "TOGGLE_MAXIMIZE": {
      return {
        ...state,
        nextZIndex: state.nextZIndex + 1,
        windows: state.windows.map((w) => {
          if (w.id !== action.id) return w;
          if (w.maximized) {
            // Restore to the bounds captured when it was maximized.
            return {
              ...w,
              position: w.maximized.prevPosition,
              size: w.maximized.prevSize,
              maximized: null,
              zIndex: state.nextZIndex,
            };
          }
          // Maximize: remember current bounds, then fill the desktop area.
          return {
            ...w,
            maximized: { prevPosition: w.position, prevSize: w.size },
            position: action.bounds.position,
            size: action.bounds.size,
            zIndex: state.nextZIndex,
          };
        }),
      };
    }

    default:
      return state;
  }
}
