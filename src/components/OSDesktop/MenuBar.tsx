import AppleGlyph from "@/components/icons/AppleGlyph";

const MENU_LABELS = ["File", "Edit", "View", "Special"];

export const MENU_BAR_HEIGHT = 28;

export default function MenuBar() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-x-0 top-0 z-[9999] flex items-center gap-4 px-3 text-[13px] font-semibold"
      style={{
        height: MENU_BAR_HEIGHT,
        background: "var(--surface-bg)",
        backdropFilter: "var(--surface-blur)",
        WebkitBackdropFilter: "var(--surface-blur)" as string,
        borderBottom: "1px solid var(--glass-border)",
        color: "var(--fg)",
      }}
    >
      <AppleGlyph className="h-3.5 w-3.5" />
      {MENU_LABELS.map((label) => (
        <span key={label}>{label}</span>
      ))}
    </div>
  );
}
