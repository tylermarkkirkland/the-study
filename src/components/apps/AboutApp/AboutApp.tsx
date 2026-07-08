// NOTE FOR TYLER: this copy is a first draft in the journal's voice — edit
// freely. Socials are placeholders; swap in whichever links you want public
// (the work email deliberately isn't here).
export default function AboutApp() {
  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-5 text-[15px] leading-relaxed text-[var(--fg-muted)]">
      <h2 className="text-lg font-semibold text-[var(--fg)]">Hi, I&apos;m Tyler</h2>
      <p>
        I&apos;m a UX product designer. By day I design for people who&apos;d rather
        be looking at photos of their grandkids than at an interface — which
        turns out to be excellent training for making things simple.
      </p>
      <p>
        By night, apparently, I build tiny computers inside tiny rooms. The desk
        you&apos;re looking at was modeled in Blender; the windows, icons, and
        this whole little operating system are hand-built. It went through three
        different broken ways of gluing this screen to that monitor before one
        stuck.
      </p>
      <p>
        Everything here is meant to be poked at. Some of it pokes back —
        keep count in the Field Notes.
      </p>
      <div className="mt-1 flex flex-wrap gap-3">
        <a
          href="https://x.com/yourhandle"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center rounded-lg border border-[var(--glass-border)] px-4 text-[14px] font-medium text-[var(--fg)] hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          X / Twitter
        </a>
        <a
          href="https://www.linkedin.com/in/yourprofile"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center rounded-lg border border-[var(--glass-border)] px-4 text-[14px] font-medium text-[var(--fg)] hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          LinkedIn
        </a>
      </div>
    </div>
  );
}
