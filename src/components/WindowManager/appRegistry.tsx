import type { ComponentType } from "react";
import type { AppType } from "@/lib/windowManager/windowReducer";
import AboutApp from "@/components/apps/AboutApp/AboutApp";
import ProjectsApp from "@/components/apps/ProjectsApp/ProjectsApp";
import NotebookApp from "@/components/apps/NotebookApp/NotebookApp";
import ResumeApp from "@/components/apps/ResumeApp/ResumeApp";
import TrashApp from "@/components/apps/TrashApp/TrashApp";

type AppRegistryEntry = {
  title: string;
  Component: ComponentType;
};

export const appRegistry: Record<AppType, AppRegistryEntry> = {
  about: { title: "About", Component: AboutApp },
  projects: { title: "Projects", Component: ProjectsApp },
  notebook: { title: "Notebook", Component: NotebookApp },
  resume: { title: "Resume", Component: ResumeApp },
  trash: { title: "Trash", Component: TrashApp },
};
