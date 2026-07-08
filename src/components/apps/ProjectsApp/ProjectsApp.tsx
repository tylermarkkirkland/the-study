const PLACEHOLDER_PROJECTS = [
  { name: "Project One", tag: "Case study" },
  { name: "Project Two", tag: "Prototype" },
  { name: "Project Three", tag: "Research" },
];

export default function ProjectsApp() {
  return (
    <div className="flex h-full flex-col gap-3 p-5 text-[var(--fg)]">
      <h2 className="text-lg font-semibold text-[var(--fg)]">Projects</h2>
      <ul className="flex flex-col gap-2">
        {PLACEHOLDER_PROJECTS.map((project) => (
          <li
            key={project.name}
            className="flex items-center justify-between rounded-lg border border-[var(--glass-border)] bg-white/5 px-3 py-3 text-[15px]"
          >
            <span className="font-medium">{project.name}</span>
            <span className="text-sm text-[var(--fg-muted)]">{project.tag}</span>
          </li>
        ))}
      </ul>
      <p className="mt-auto text-sm text-[var(--fg-muted)]">More coming soon.</p>
    </div>
  );
}
