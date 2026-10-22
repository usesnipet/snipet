import type { Milestone } from "../../lib/github";

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "";

export function Roadmap({ roadmap }: { roadmap: Milestone[] }) {
  if (roadmap.length === 0) return null;
  return (
    <section id="roadmap" className="scroll-mt-14 border-t bg-muted">
      <div className="mx-auto max-w-3xl px-4 py-20">
        <h2 className="text-center text-3xl font-bold tracking-tight">Roadmap</h2>
        <p className="mt-3 text-center text-muted-foreground">What shipped recently and what is coming next.</p>
        <ol className="mt-12 border-l pl-6">
          {roadmap.map((m) => (
            <li key={m.title} className="relative pb-10 last:pb-0">
              <span
                className={`absolute top-1.5 -left-7.75 size-3 rounded-full border-2 ${
                  m.state === "closed" ? "border-primary bg-primary" : "border-muted-foreground bg-background"
                }`}
              />
              <div className="flex flex-wrap items-baseline gap-x-3">
                <h3 className="font-semibold">{m.title}</h3>
                <span className="text-sm text-muted-foreground">
                  {m.state === "closed" ? "Shipped" : "Planned"} · {formatDate(m.due_on)}
                </span>
              </div>
              {m.description.map((d) => (
                <p key={d} className="mt-1 text-muted-foreground">{d}</p>
              ))}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
