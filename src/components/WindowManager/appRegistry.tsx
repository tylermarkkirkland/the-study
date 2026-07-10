import type { ComponentType } from "react";
import type { AppType } from "@/lib/windowManager/windowReducer";
import AboutApp from "@/components/apps/AboutApp/AboutApp";
import NotebookApp from "@/components/apps/NotebookApp/NotebookApp";
import TerminalApp from "@/components/apps/TerminalApp/TerminalApp";
import GameApp from "@/components/apps/GameApp/GameApp";
import TrashApp from "@/components/apps/TrashApp/TrashApp";
import DocumentViewer from "@/components/apps/DocumentViewer/DocumentViewer";

type AppRegistryEntry = {
  title: string;
  // Document windows receive the focused window's documentId; every other app
  // ignores it, which is fine — a prop-less component satisfies this type.
  Component: ComponentType<{ documentId?: string }>;
};

export const appRegistry: Record<AppType, AppRegistryEntry> = {
  about: { title: "About", Component: AboutApp },
  notebook: { title: "Notes", Component: NotebookApp },
  terminal: { title: "Terminal", Component: TerminalApp },
  game: { title: "Topple the Tower", Component: GameApp },
  trash: { title: "Trash", Component: TrashApp },
  // Title is a fallback; openWindow passes the document's fileName as the title.
  document: { title: "Document", Component: DocumentViewer },
};
