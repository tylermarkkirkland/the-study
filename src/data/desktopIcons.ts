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
  { id: "icon-projects", appType: "projects", label: "Projects", position: { top: "60%", left: "9%" } },
  { id: "icon-notebook", appType: "notebook", label: "Notebook", position: { top: "12%", left: "80%" } },
  { id: "icon-resume", appType: "resume", label: "Resume", position: { top: "45%", left: "84%" } },
  { id: "icon-trash", appType: "trash", label: "Trash", position: { top: "78%", left: "83%" } },
];
