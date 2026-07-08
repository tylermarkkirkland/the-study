"use client";

import { desktopIcons } from "@/data/desktopIcons";
import { useDesktopIcons } from "@/components/OSDesktop/DesktopIconsContext";
import AppIcon from "@/components/icons/AppIcon";

export default function TrashApp() {
  const { trashedIds, restoreIcon } = useDesktopIcons();
  const items = desktopIcons.filter((icon) => trashedIds.includes(icon.id));

  if (items.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-5 text-center text-[var(--fg-muted)]">
        <p className="text-[15px]">The Trash is empty.</p>
        <p className="text-sm">Drag an icon onto the Trash to move it here.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 p-5 text-[var(--fg)]">
      <h2 className="text-lg font-semibold text-[var(--fg)]">Trash</h2>
      <ul className="flex flex-col gap-2">
        {items.map((icon) => (
          <li
            key={icon.id}
            className="flex items-center gap-3 rounded-lg border border-[var(--glass-border)] bg-white/5 px-3 py-2.5"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center">
              <AppIcon appType={icon.appType} className="h-8 w-8" />
            </span>
            <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{icon.label}</span>
            <button
              type="button"
              onClick={() => restoreIcon(icon.id)}
              className="inline-flex h-11 items-center justify-center rounded-full border border-[var(--glass-border)] bg-white/5 px-4 text-[14px] font-medium text-[var(--fg)] transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              Put Back
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-auto text-sm text-[var(--fg-muted)]">
        Items in the Trash are kept — nothing is permanently deleted.
      </p>
    </div>
  );
}
