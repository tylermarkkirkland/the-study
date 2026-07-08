export default function AboutApp() {
  return (
    <div className="flex h-full flex-col gap-3 p-5 text-[15px] leading-relaxed text-[var(--fg-muted)]">
      <h2 className="text-lg font-semibold text-[var(--fg)]">Hi, I&apos;m [Your Name]</h2>
      <p>
        I&apos;m a UX product designer who likes building interfaces that feel a
        little more alive than a static resume. This desk is a work in
        progress &mdash; the windows, icons, and this whole little computer are
        the real portfolio.
      </p>
      <p>Poke around the desktop. Nothing here will bite.</p>
    </div>
  );
}
