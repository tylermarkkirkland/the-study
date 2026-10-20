"use client";

import { desktopIcons } from "@/data/desktopIcons";
import { useDesktopIcons } from "@/components/OSDesktop/DesktopIconsContext";
import { useWindowManager } from "@/components/WindowManager/WindowManagerContext";
import AppIcon from "@/components/icons/AppIcon";

export default function TrashApp() {
  const { trashedIds, restoreIcon } = useDesktopIcons();
  const { openWindow } = useWindowManager();
  const items = desktopIcons.filter((icon) => trashedIds.includes(icon.id));

  return (
    <div className="flex h-full flex-col gap-3 p-5 text-[var(--fg)]">
      <h2 className="text-lg font-semibold text-[var(--fg)]">Trash</h2>
      <ul className="flex flex-col gap-2">
        {items.map((icon) => {
          const isDocument = icon.appType === "document";
          const label = icon.label;
          return (
            <li
              key={icon.id}
              className="flex items-center gap-3 rounded-lg border border-[var(--glass-border)] bg-white/5 px-3 py-2.5"
            >
              {isDocument ? (
                // A document row opens the file when its icon/name is clicked.
                <button
                  type="button"
                  onClick={() => openWindow("document", { documentId: icon.id, title: label })}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                  aria-label={`Open ${label}`}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center">
                    <AppIcon appType={icon.appType} className="h-8 w-8" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{label}</span>
                </button>
              ) : (
                <>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center">
                    <AppIcon appType={icon.appType} className="h-8 w-8" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{label}</span>
                </>
              )}
              <button
                type="button"
                onClick={() => restoreIcon(icon.id)}
                className="inline-flex h-11 shrink-0 items-center justify-center rounded-full border border-[var(--glass-border)] bg-white/5 px-4 text-[14px] font-medium text-[var(--fg)] transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                Put Back
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
