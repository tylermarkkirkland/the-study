"use client";

import { useRef } from "react";
import { WindowManagerProvider } from "@/components/WindowManager/WindowManagerContext";
import WindowLayer from "@/components/WindowManager/WindowLayer";
import AutoOpenWindows from "@/components/WindowManager/AutoOpenWindows";
import type { AppType } from "@/lib/windowManager/windowReducer";
import MenuBar, { MENU_BAR_HEIGHT } from "./MenuBar";
import DesktopBackground from "./DesktopBackground";
import DesktopIconGrid from "./DesktopIconGrid";
import Dock from "./Dock";
import { DesktopIconsProvider } from "./DesktopIconsContext";
import DiscoveryToaster from "@/components/DiscoveryToaster/DiscoveryToaster";
import CompletionConfetti from "@/components/CompletionConfetti/CompletionConfetti";
import CompletionPopup from "@/components/CompletionPopup/CompletionPopup";
import powerOn from "./PowerOn.module.css";

// Apps opened automatically on a fresh page load — Field Notes greets the
// visitor as a starting point. Module-level so the array reference stays stable.
const AUTO_OPEN_APPS: AppType[] = ["notebook"];

export default function OSDesktop() {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <WindowManagerProvider>
      <AutoOpenWindows apps={AUTO_OPEN_APPS} />
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
        {/* Both portal to document.body, so they float over the whole room at
            the real viewport rather than on the corner-pinned monitor. */}
        <DiscoveryToaster />
        <CompletionConfetti />
        <CompletionPopup />
      </DesktopIconsProvider>
    </WindowManagerProvider>
  );
}
