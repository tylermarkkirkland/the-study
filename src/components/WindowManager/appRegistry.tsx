import type { ComponentType } from "react";
import type { AppType } from "@/lib/windowManager/windowReducer";
import AboutApp from "@/components/apps/AboutApp/AboutApp";
import NotebookApp from "@/components/apps/NotebookApp/NotebookApp";
import TerminalApp from "@/components/apps/TerminalApp/TerminalApp";
import GameApp from "@/components/apps/GameApp/GameApp";
import TrashApp from "@/components/apps/TrashApp/TrashApp";

type AppRegistryEntry = {
  title: string;
  Component: ComponentType;
};

export const appRegistry: Record<AppType, AppRegistryEntry> = {
  about: { title: "About", Component: AboutApp },
  notebook: { title: "Field Notes", Component: NotebookApp },
  terminal: { title: "Terminal", Component: TerminalApp },
  game: { title: "Arcade", Component: GameApp },
  trash: { title: "Trash", Component: TrashApp },
};
