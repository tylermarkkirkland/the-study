import type { AppType } from "@/lib/windowManager/windowReducer";

export type DesktopIconDescriptor = {
  id: string;
  appType: AppType;
  label: string;
  position: { top: string; left: string };
};

// Hand-placed across the desktop — a real desktop, not a tidy grid.
export const desktopIcons: DesktopIconDescriptor[] = [
  { id: "icon-about", appType: "about", label: "About", position: { top: "7%", left: "5%" } },
  { id: "icon-terminal", appType: "terminal", label: "Terminal", position: { top: "60%", left: "9%" } },
  { id: "icon-notebook", appType: "notebook", label: "Notes", position: { top: "12%", left: "80%" } },
  // Non-breaking space keeps "Topple the" together; the newline forces "Tower"
  // onto its own line (see whitespace-pre-line on the label in DesktopIcon).
  { id: "icon-game", appType: "game", label: "Topple the\nTower", position: { top: "45%", left: "84%" } },
  { id: "icon-trash", appType: "trash", label: "Trash", position: { top: "78%", left: "83%" } },

  // Documents (appType "document"). These default to sitting in the Trash (see
  // DesktopIconsContext's restoredDocs model); the position below is only where
  // they land if the user restores them to the desktop. The id matches the
  // document's content entry in trashDocuments.ts, and the label is its filename.
  { id: "doc-grocery", appType: "document", label: "grocery_list.txt", position: { top: "40%", left: "32%" } },
  { id: "doc-standup", appType: "document", label: "standup_notes.txt", position: { top: "40%", left: "50%" } },
  { id: "doc-donotopen", appType: "document", label: "DO_NOT_OPEN.txt", position: { top: "26%", left: "40%" } },
  { id: "doc-resume", appType: "document", label: "resume_draft_v2.txt", position: { top: "56%", left: "40%" } },
];
