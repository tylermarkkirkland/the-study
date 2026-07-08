"use client";

import { useRef } from "react";
import { WindowManagerProvider } from "@/components/WindowManager/WindowManagerContext";
import WindowLayer from "@/components/WindowManager/WindowLayer";
import MenuBar, { MENU_BAR_HEIGHT } from "./MenuBar";
import DesktopBackground from "./DesktopBackground";
import DesktopIconGrid from "./DesktopIconGrid";
import Dock from "./Dock";
import { DesktopIconsProvider } from "./DesktopIconsContext";
import powerOn from "./PowerOn.module.css";

export default function OSDesktop() {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <WindowManagerProvider>
      <DesktopIconsProvider>
        {/* CRT power-on wrapper: the whole desktop (menu bar, icons, dock)
            snaps on like a monitor waking up. CSS-only; reduced-motion users
            get an instant-on desktop via the media query in the module. */}
        <div className={`absolute inset-0 ${powerOn.powerOn}`}>
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
        </div>
      </DesktopIconsProvider>
    </WindowManagerProvider>
  );
}
