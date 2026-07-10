"use client";

import { useEffect } from "react";
import { getTrashDocument } from "@/data/trashDocuments";
import { markFound } from "@/lib/discovery/discoveryStore";

// Generic .txt viewer for the files that live in the Trash. The window carries a
// `documentId` (see WindowState) that we look up in trashDocuments. Opening a
// document with a `discovery` marks it found on mount — that's how DO_NOT_OPEN.txt
// registers the "trash-file" discovery — mirroring the interaction-site pattern of
// game-beat / terminal-matrix. Real text (not an image) so it's screen-reader
// friendly, consistent with the a11y-first DeskDustClue puzzle.
export default function DocumentViewer({ documentId }: { documentId?: string }) {
  const doc = getTrashDocument(documentId);
  const discovery = doc?.discovery;

  useEffect(() => {
    if (discovery) markFound(discovery);
  }, [discovery]);

  if (!doc) {
    return (
      <div className="flex h-full items-center justify-center p-5 text-center font-mono text-[14px] text-[var(--fg-muted)]">
        This file couldn&apos;t be found. It may have been emptied for real.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-5 font-mono text-[14px] leading-relaxed text-[var(--fg-muted)]">
      {doc.body.map((line, i) => (
        <p key={i} className={i === 0 ? "text-[var(--fg)]" : undefined}>
          {line}
        </p>
      ))}
      {doc.signoff ? <p className="mt-auto text-[var(--fg)]">{doc.signoff}</p> : null}
    </div>
  );
}
