"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { desktopIcons } from "@/data/desktopIcons";
import { useWindowManager } from "@/components/WindowManager/WindowManagerContext";
import { useDesktopIcons, type Pos } from "./DesktopIconsContext";
import DesktopIcon from "./DesktopIcon";

// Approximate icon footprint (w-20 button + label), used for the "dropped onto
// the Trash" hit test. Generous enough that centering an icon over the Trash
// counts, without being so loose that a near-miss trashes it.
const ICON_W = 80;
const ICON_H = 88;

export default function DesktopIconGrid() {
  const { openWindow } = useWindowManager();
  const { positions, trashedIds, ensureSeeded, moveIcon, trashIcon } = useDesktopIcons();
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [trashHot, setTrashHot] = useState(false);

  const trashDescriptor = desktopIcons.find((i) => i.appType === "trash");
  const trashId = trashDescriptor?.id;

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (size) ensureSeeded(size);
  }, [size, ensureSeeded]);

  // True when an icon's center is dropped/held over the Trash icon's footprint.
  const isOverTrash = (pos: Pos) => {
    if (!trashId) return false;
    const t = positions[trashId];
    if (!t) return false;
    const cx = pos.x + ICON_W / 2;
    const cy = pos.y + ICON_H / 2;
    return cx > t.x && cx < t.x + ICON_W && cy > t.y && cy < t.y + ICON_H;
  };

  const handleDragMove = (id: string, pos: Pos) => {
    if (id === trashId) return;
    setTrashHot(isOverTrash(pos));
  };

  const handleDrop = (id: string, pos: Pos) => {
    setTrashHot(false);
    if (id !== trashId && isOverTrash(pos)) {
      trashIcon(id);
      return;
    }
    moveIcon(id, pos);
  };

  return (
    <div ref={containerRef} className="absolute inset-0">
      {size &&
        desktopIcons.map((icon) => {
          if (trashedIds.includes(icon.id)) return null;
          const pos = positions[icon.id];
          if (!pos) return null;
          return (
            <DesktopIcon
              key={icon.id}
              appType={icon.appType}
              label={icon.label}
              position={pos}
              bounds={size}
              highlight={icon.id === trashId && trashHot}
              onOpen={openWindow}
              onDragMove={(next) => handleDragMove(icon.id, next)}
              onDrop={(next) => handleDrop(icon.id, next)}
            />
          );
        })}
    </div>
  );
}
