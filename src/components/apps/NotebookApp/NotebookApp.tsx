"use client";

import { useState } from "react";

export default function NotebookApp() {
  const [text, setText] = useState(
    "Jot down a note...\n\n(This doesn't save yet, but it will.)"
  );

  return (
    <div className="flex h-full flex-col gap-2 p-4">
      <h2 className="px-1 text-lg font-semibold text-[var(--fg)]">Notebook</h2>
      <label htmlFor="notebook-textarea" className="sr-only">
        Notebook contents
      </label>
      <textarea
        id="notebook-textarea"
        value={text}
        onChange={(event) => setText(event.target.value)}
        className="h-full w-full flex-1 resize-none rounded-lg border border-[var(--glass-border)] bg-white/5 p-3 text-[15px] leading-relaxed text-[var(--fg)] outline-none placeholder:text-[var(--fg-muted)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      />
    </div>
  );
}
