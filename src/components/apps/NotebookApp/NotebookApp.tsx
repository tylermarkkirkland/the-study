"use client";

import { discoveries } from "@/data/discoveries";
import { useDiscoveries } from "@/lib/discovery/discoveryStore";

const SHARE_URL = "https://x.com/intent/tweet";

// Field Notes: a first-person log of the room's mysteries, doubling as the
// discovery checklist. Items flip from a hint to a green, checked "found"
// line the moment the matching interaction happens anywhere in the OS or the
// room (see discoveryStore).
export default function NotebookApp() {
  const found = useDiscoveries();
  const foundCount = discoveries.filter((d) => found.has(d.id)).length;
  const allFound = foundCount === discoveries.length;

  const shareText = `I found all ${discoveries.length} secrets hidden in this desk. See if you can. `;
  const shareHref = `${SHARE_URL}?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(
    typeof window === "undefined" ? "" : window.location.origin,
  )}`;

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-5">
      <div>
        <h2 className="text-lg font-semibold text-[var(--fg)]">Field Notes</h2>
        <p className="mt-1 text-[14px] leading-relaxed text-[var(--fg-muted)]">
          Things I&apos;ve noticed around this room that don&apos;t quite add up.
          Crossing them off as I figure them out.
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
                  {d.foundLabel}
                </span>
              ) : (
                <span className="text-[var(--fg-muted)]">
                  <span className="sr-only">Still a mystery: </span>
                  {d.hidden ? "???" : d.hint}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {allFound ? (
        <div className="mt-1 rounded-lg border border-[var(--glass-border)] bg-white/5 p-4">
          <p className="text-[15px] font-semibold" style={{ color: "var(--tl-zoom)" }}>
            That&apos;s all of them. This room is out of mysteries.
          </p>
          <p className="mt-1 text-[14px] leading-relaxed text-[var(--fg-muted)]">
            You explored more of this desk than most people explore their own.
          </p>
          <a
            href={shareHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-[var(--accent)] px-4 text-[14px] font-medium text-[var(--accent-fg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            Share what you found
          </a>
        </div>
      ) : null}
    </div>
  );
}
