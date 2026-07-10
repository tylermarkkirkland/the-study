import type { CSSProperties } from "react";
import { HACK_PASSCODE } from "@/lib/hackPasscode";
import PasscodeText from "@/components/PasscodeText/PasscodeText";

type DeskDustClueProps = {
  className?: string;
  style?: CSSProperties;
};

/**
 * The passcode clue for the terminal `hack` command — handwritten on the sticky
 * notepad on the desk. Styled as legible pen ink (not faint dust): the note sits
 * farther from the camera in the room, so it needs contrast to read at a small
 * on-screen size, while still looking like a scribbled note-to-self.
 *
 * Pure text (no paper/UI chrome), so it lays flat on the notepad via a drei
 * <Html transform> wrapper in the 3D scene, or skews onto the desk in the CSS
 * fallback. Intentionally NOT aria-hidden — the code is part of a puzzle, so
 * hiding it from assistive tech would make it unsolvable for screen-reader and
 * keyboard users; the label says it's written on the sticky note so it reads
 * sensibly out of visual context.
 */
export default function DeskDustClue({ className = "", style }: DeskDustClueProps) {
  return (
    <div
      role="note"
      aria-label={`Handwritten on the sticky note on the desk: ${HACK_PASSCODE}`}
      className={`pointer-events-none select-none ${className}`}
      style={style}
    >
      <span
        aria-hidden="true"
        className="block whitespace-nowrap text-[15px] font-semibold tracking-[0.12em] text-[#242a63]"
        style={{
          // Ballpoint-ink look on light paper: dark blue, handwritten, with a
          // hair of white relief so it reads like ink pressed into the note.
          fontFamily: "'Segoe Print', 'Bradley Hand', 'Comic Sans MS', cursive",
          textShadow: "0 0.5px 0 rgba(255, 255, 255, 0.4)",
        }}
      >
        <PasscodeText code={HACK_PASSCODE} />
      </span>
    </div>
  );
}
