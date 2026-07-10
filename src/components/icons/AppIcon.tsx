import type { AppType } from "@/lib/windowManager/windowReducer";

type AppIconProps = {
  appType: AppType;
  className?: string;
};

// Shared squircle background + soft top highlight, so every app icon reads as a
// modern macOS-style rounded-rect tile. `id` seeds a per-icon gradient.
function Squircle({ id, from, to }: { id: string; from: string; to: string }) {
  return (
    <>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
      </defs>
      <rect x="3" y="3" width="34" height="34" rx="9.5" fill={`url(#${id})`} />
      <rect
        x="3"
        y="3"
        width="34"
        height="34"
        rx="9.5"
        fill="none"
        stroke="rgba(255,255,255,0.25)"
        strokeWidth="1"
      />
    </>
  );
}

/**
 * Modern app icons — gradient-filled squircle tiles with a simple white glyph,
 * replacing the older System 7 bitmap-style line art. The `appType` + `className`
 * API is unchanged; each icon now carries its own fills (no `currentColor`).
 */
export default function AppIcon({ appType, className }: AppIconProps) {
  const white = "#ffffff";

  switch (appType) {
    case "about":
      // Info "i" on a blue tile.
      return (
        <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
          <Squircle id="appicon-about" from="#3a9bff" to="#0a63d6" />
          <circle cx="20" cy="13" r="2.4" fill={white} />
          <rect x="17.6" y="18" width="4.8" height="11" rx="2.4" fill={white} />
        </svg>
      );
    case "terminal":
      // Prompt ">_" on a near-black tile.
      return (
        <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
          <Squircle id="appicon-terminal" from="#3a3a40" to="#141416" />
          <path
            d="M12 14l6 6-6 6"
            fill="none"
            stroke={white}
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect x="21" y="24.7" width="8" height="2.6" rx="1.3" fill={white} />
        </svg>
      );
    case "notebook":
      // Lined note on an amber tile.
      return (
        <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
          <Squircle id="appicon-notebook" from="#ffb64d" to="#f08a1d" />
          <rect x="12" y="10" width="16" height="20" rx="2.4" fill={white} />
          <line x1="15.5" y1="16" x2="24.5" y2="16" stroke="#f08a1d" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="15.5" y1="20" x2="24.5" y2="20" stroke="#f08a1d" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="15.5" y1="24" x2="21" y2="24" stroke="#f08a1d" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case "game":
      // The Silent on a black tile.
      return (
        <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
          <defs>
            <clipPath id="appicon-game-clip">
              <rect x="3" y="3" width="34" height="34" rx="9.5" />
            </clipPath>
          </defs>
          <Squircle id="appicon-game" from="#1c1c20" to="#050506" />
          <image
            href="/images/silent-icon.png"
            x="3"
            y="3"
            width="34"
            height="34"
            clipPath="url(#appicon-game-clip)"
            preserveAspectRatio="xMidYMid meet"
          />
        </svg>
      );
    case "trash":
      // Trash can on a slate tile.
      return (
        <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
          <Squircle id="appicon-trash" from="#9aa0aa" to="#6b7280" />
          <rect x="16" y="10" width="8" height="2.6" rx="1.3" fill={white} />
          <rect x="12" y="13.5" width="16" height="2.6" rx="1.3" fill={white} />
          <path d="M14 17h12l-1.1 12.4a1.6 1.6 0 0 1-1.6 1.5h-6.6a1.6 1.6 0 0 1-1.6-1.5Z" fill={white} />
          <line x1="18" y1="20" x2="18" y2="27.5" stroke="#6b7280" strokeWidth="1.4" strokeLinecap="round" />
          <line x1="22" y1="20" x2="22" y2="27.5" stroke="#6b7280" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    case "document":
      // A .txt file — white dog-eared page with text lines, on a slate tile.
      return (
        <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
          <Squircle id="appicon-document" from="#7d8590" to="#4b5563" />
          <path d="M13 10h9l5 5v15a1.6 1.6 0 0 1-1.6 1.6H13Z" fill={white} />
          <path d="M22 10v5h5" fill="none" stroke="#4b5563" strokeWidth="1.4" strokeLinejoin="round" />
          <line x1="16" y1="20" x2="24" y2="20" stroke="#4b5563" strokeWidth="1.4" strokeLinecap="round" />
          <line x1="16" y1="23.5" x2="24" y2="23.5" stroke="#4b5563" strokeWidth="1.4" strokeLinecap="round" />
          <line x1="16" y1="27" x2="21" y2="27" stroke="#4b5563" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
}
