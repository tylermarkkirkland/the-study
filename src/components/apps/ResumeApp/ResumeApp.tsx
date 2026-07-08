export default function ResumeApp() {
  return (
    <div className="flex h-full flex-col gap-4 p-5 text-[var(--fg)]">
      <div>
        <h2 className="text-lg font-semibold text-[var(--fg)]">Resume</h2>
        <p className="text-sm text-[var(--fg-muted)]">A quick summary &mdash; full PDF coming soon.</p>
      </div>
      <div className="flex flex-col gap-2 text-[15px]">
        <p className="font-medium text-[var(--fg)]">UX Product Designer</p>
        <p>FamilySearch &middot; Present</p>
        <p className="text-[var(--fg-muted)]">
          Placeholder content. Real experience, skills, and downloadable
          resume will live here.
        </p>
      </div>
      <button
        type="button"
        className="mt-auto inline-flex h-11 cursor-not-allowed items-center justify-center rounded-full border border-[var(--glass-border)] bg-white/5 px-4 text-[15px] font-medium text-[var(--fg-muted)]"
        disabled
      >
        Download Resume (coming soon)
      </button>
    </div>
  );
}
