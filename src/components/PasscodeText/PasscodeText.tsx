// Renders a passcode with its "0" slashed, so it can't be misread as the letter
// "o" in the handwritten desk fonts (otherwise "H0wl3r42" reads like the word
// "Howl3r42"). Slashing the zero is the handwritten convention for exactly this.
// The slash spans are decorative (aria-hidden); the character stays "0" in the
// text content, so assistive tech still reads the real passcode.
export default function PasscodeText({ code }: { code: string }) {
  return (
    <>
      {code.split("").map((char, i) =>
        char === "0" ? (
          <span key={i} className="relative inline-block">
            0
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-1/2 h-[1.15em] w-[2px] -translate-x-1/2 -translate-y-1/2 rotate-[38deg] bg-current"
            />
          </span>
        ) : (
          <span key={i}>{char}</span>
        ),
      )}
    </>
  );
}
