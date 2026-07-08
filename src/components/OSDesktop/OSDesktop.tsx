"use client";

import { useRef } from "react";
import { WindowManagerProvider } from "@/components/WindowManager/WindowManagerContext";
import WindowLayer from "@/components/WindowManager/WindowLayer";
import MenuBar, { MENU_BAR_HEIGHT } from "./MenuBar";
import DesktopBackground from "./DesktopBackground";
import DesktopIconGrid from "./DesktopIconGrid";
import Dock from "./Dock";
import { DesktopIconsProvider } from "./DesktopIconsContext";

export default function OSDesktop() {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <WindowManagerProvider>
      <DesktopIconsProvider>
        <MenuBar />
        <div
          ref={containerRef}
          className="absolute inset-x-0 bottom-0"
          style={{ top: MENU_BAR_HEIGHT }}
        >
          <DesktopBackground />
          <DesktopIconGrid />
          <WindowLayer containerRef={containerRef} />
        </div>
        <Dock />
      </DesktopIconsProvider>
    </WindowManagerProvider>
  );
}
