"use client";

import { Fragment } from "react";
import { discoveries, COMPLETION_LINES } from "@/data/discoveries";
import { useDiscoveries } from "@/lib/discovery/discoveryStore";

// Renders *word* as italic emphasis so a clue can hint at a literal term to type
// (e.g. the `hack` terminal command). Everything outside the asterisks is plain.
function renderEmphasis(text: string) {
  return text.split(/(\*[^*]+\*)/g).map((part, i) =>
    part.length > 2 && part.startsWith("*") && part.endsWith("*") ? (
      <em key={i}>{part.slice(1, -1)}</em>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

// Field Notes: a first-person log of the room's mysteries, doubling as the
// discovery checklist. Items flip from a hint to a green, checked "found"
// line the moment the matching interaction happens anywhere in the OS or the
// room (see discoveryStore).
export default function NotebookApp() {
  const found = useDiscoveries();
  const foundCount = discoveries.filter((d) => found.has(d.id)).length;
  const allFound = foundCount === discoveries.length;

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-5">
      <div>
        <h2 className="text-lg font-semibold text-[var(--fg)]">Notes</h2>
        <p className="mt-1 text-[14px] leading-relaxed text-[var(--fg-muted)]">
          Things about this room that don&apos;t quite add up. I need to get all
          this figured out.
        </p>
      </div>

      <p className="text-[13px] font-medium text-[var(--fg-muted)]" aria-live="polite">
        {foundCount} of {discoveries.length} figured out
      </p>

      <ul className="flex flex-col gap-3">
        {discoveries.map((d) => {
          const isFound = found.has(d.id);
          return (
            <li key={d.id} className="flex items-start gap-2.5 text-[15px] leading-relaxed">
              <span
                aria-hidden="true"
                className="mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold"
                style={
                  isFound
                    ? { borderColor: "var(--tl-zoom)", color: "var(--tl-zoom)" }
                    : { borderColor: "var(--fg-muted)", color: "transparent" }
                }
              >
                ✓
              </span>
              {isFound ? (
                <span style={{ color: "var(--tl-zoom)" }}>
                  <span className="sr-only">Figured out: </span>
                  {renderEmphasis(d.foundLabel)}
                </span>
              ) : (
                <span className="text-[var(--fg-muted)]">
                  <span className="sr-only">Still a mystery: </span>
                  {d.hidden ? "???" : renderEmphasis(d.hint)}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {allFound ? (
        <div className="mt-1 rounded-lg border border-[var(--glass-border)] bg-white/5 p-4">
          <p className="text-[15px] font-semibold" style={{ color: "var(--tl-zoom)" }}>
            {COMPLETION_LINES[0]}
          </p>
          <p className="mt-1 text-[14px] leading-relaxed text-[var(--fg-muted)]">
            {COMPLETION_LINES[1]}
          </p>
        </div>
      ) : null}
    </div>
  );
}
