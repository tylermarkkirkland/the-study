"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { journalEntries } from "@/data/journalEntries";
import {
  addEntry,
  getEntries,
  MESSAGE_MAX,
  NAME_MAX,
  STICKERS,
  type GuestbookEntry,
} from "@/lib/guestbook/guestbookStore";
import { markFound } from "@/lib/discovery/discoveryStore";
import { DURATION, EASE_OUT } from "@/lib/motion/easings";
import styles from "./GuestbookOverlay.module.css";

type GuestbookOverlayProps = {
  open: boolean;
  onClose: () => void;
};

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

// The book on the desk: Tyler's build-log pages pinned up top, then a wall of
// visitor signatures. Local-first — entries persist in this browser via
// guestbookStore; the shared backend swaps in behind that module later.
export default function GuestbookOverlay({ open, onClose }: GuestbookOverlayProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [xHandle, setXHandle] = useState("");
  const [sticker, setSticker] = useState(STICKERS[0]);
  const [honeypot, setHoneypot] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [justSigned, setJustSigned] = useState(false);

  // Read storage each time the book opens (not at module init) so another
  // tab's signatures — or later, the shared backend — show up fresh. The
  // version bump re-reads after a successful sign.
  const [entriesVersion, setEntriesVersion] = useState(0);
  const entries = useMemo<GuestbookEntry[]>(() => {
    void entriesVersion; // referenced so the version bump invalidates the memo
    return open ? getEntries() : [];
  }, [open, entriesVersion]);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previouslyFocused.current?.focus();
    };
  }, [open, onClose]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    // Honeypot tripped: pretend everything went fine, save nothing.
    if (honeypot) {
      setName("");
      setMessage("");
      setXHandle("");
      setJustSigned(true);
      return;
    }

    const result = addEntry({ name, message, xHandle, sticker });
    if (!result.ok) {
      setError(result.error);
      return;
    }

    markFound("guestbook-sign");
    setEntriesVersion((v) => v + 1);
    setName("");
    setMessage("");
    setXHandle("");
    setJustSigned(true);
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: DURATION.base, ease: EASE_OUT }}
          onClick={onClose}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="guestbook-overlay-title"
            className={`relative max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-[var(--radius-window)] p-8 pr-6 font-mono text-[var(--fg)] shadow-[var(--glass-shadow)] ${styles.paper}`}
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: DURATION.base, ease: EASE_OUT }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label="Close guestbook"
              className="absolute top-4 right-4 flex h-11 w-11 items-center justify-center rounded-full text-xl text-[var(--fg-muted)] hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              ×
            </button>

            <h2 id="guestbook-overlay-title" className="pr-12 text-2xl font-semibold tracking-tight">
              Guestbook
            </h2>

            {/* Tyler's pinned build-log pages — collapsed so the sign form stays
                within reach, but always the first thing in the book. */}
            <section aria-label="Field notes from the author" className="mt-6 flex flex-col gap-3">
              {journalEntries.map((entry) => (
                <details
                  key={entry.title}
                  className="rounded-lg border border-[var(--glass-border)] bg-white/5 px-4 py-3"
                >
                  <summary className="cursor-pointer text-[15px] font-semibold marker:text-[var(--fg-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]">
                    {entry.title}
                  </summary>
                  <p className="mt-2 whitespace-pre-line text-[14px] leading-relaxed text-[var(--fg-muted)]">
                    {entry.body}
                  </p>
                </details>
              ))}
            </section>

            {/* Sign form */}
            <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
              <h3 className="text-lg font-semibold">Sign the guestbook</h3>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="gb-name" className="text-[13px] font-medium text-[var(--fg-muted)]">
                  Name <span aria-hidden="true">*</span>
                </label>
                <input
                  id="gb-name"
                  type="text"
                  required
                  maxLength={NAME_MAX}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="min-h-11 rounded-lg border border-[var(--glass-border)] bg-white/5 px-3 text-[15px] text-[var(--fg)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="gb-message" className="text-[13px] font-medium text-[var(--fg-muted)]">
                  Leave a note (optional)
                </label>
                <textarea
                  id="gb-message"
                  maxLength={MESSAGE_MAX}
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="resize-none rounded-lg border border-[var(--glass-border)] bg-white/5 p-3 text-[15px] leading-relaxed text-[var(--fg)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                />
                <span className="self-end text-[12px] text-[var(--fg-muted)]">
                  {message.length}/{MESSAGE_MAX}
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="gb-handle" className="text-[13px] font-medium text-[var(--fg-muted)]">
                  X handle (optional — links your signature)
                </label>
                <input
                  id="gb-handle"
                  type="text"
                  maxLength={16}
                  value={xHandle}
                  onChange={(e) => setXHandle(e.target.value)}
                  placeholder="@you"
                  className="min-h-11 rounded-lg border border-[var(--glass-border)] bg-white/5 px-3 text-[15px] text-[var(--fg)] outline-none placeholder:text-[var(--fg-muted)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                />
              </div>

              <fieldset className="flex flex-col gap-1.5">
                <legend className="text-[13px] font-medium text-[var(--fg-muted)]">
                  Pick a sticker
                </legend>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Sticker">
                  {STICKERS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      role="radio"
                      aria-checked={sticker === s}
                      aria-label={`Sticker ${s}`}
                      onClick={() => setSticker(s)}
                      className="flex h-11 w-11 items-center justify-center rounded-lg border text-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                      style={{
                        borderColor: sticker === s ? "var(--accent)" : "var(--glass-border)",
                        background: sticker === s ? "rgba(10,132,255,0.18)" : "rgba(255,255,255,0.05)",
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </fieldset>

              {/* Honeypot — humans never see or reach this field. */}
              <div className={styles.honeypot} aria-hidden="true">
                <label htmlFor="gb-website">Website</label>
                <input
                  id="gb-website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                />
              </div>

              {error ? (
                <p role="alert" className="text-[14px] text-[var(--tl-close)]" style={{ color: "var(--tl-close)" }}>
                  {error}
                </p>
              ) : null}
              {justSigned && !error ? (
                <p role="status" className="text-[14px]" style={{ color: "var(--tl-zoom)" }}>
                  Thanks for signing — you&apos;re part of the desk now.
                </p>
              ) : null}

              <button
                type="submit"
                className="min-h-11 self-start rounded-lg bg-[var(--accent)] px-5 text-[15px] font-medium text-[var(--accent-fg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                Sign
              </button>
            </form>

            {/* Signatures */}
            <section aria-label="Signatures" className="mt-8">
              <h3 className="text-lg font-semibold">
                Signatures{entries.length > 0 ? ` (${entries.length})` : ""}
              </h3>
              {entries.length === 0 ? (
                <p className="mt-2 text-[14px] text-[var(--fg-muted)]">
                  Be the first to sign.
                </p>
              ) : (
                <ul className="mt-3 flex flex-col gap-3">
                  {entries.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex items-start gap-3 rounded-lg border border-[var(--glass-border)] bg-white/5 px-4 py-3"
                    >
                      <span aria-hidden="true" className="text-xl leading-none">
                        {entry.sticker}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[15px] font-semibold break-words">
                          {entry.name}
                          {entry.xHandle ? (
                            <>
                              {" "}
                              <a
                                href={`https://x.com/${entry.xHandle}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-normal text-[var(--accent)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                              >
                                @{entry.xHandle}
                              </a>
                            </>
                          ) : null}
                        </p>
                        {entry.message ? (
                          <p className="mt-1 text-[14px] leading-relaxed break-words text-[var(--fg-muted)]">
                            {entry.message}
                          </p>
                        ) : null}
                        <p className="mt-1 text-[12px] text-[var(--fg-muted)]">
                          {new Date(entry.createdAt).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
