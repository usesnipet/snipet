/** GitHub milestone fields the roadmap uses. */
export type Milestone = { title: string; description: string | null; state: "open" | "closed"; due_on: string | null };

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "";

export function Roadmap({ roadmap }: { roadmap: Milestone[] }) {
  if (roadmap.length === 0) return null;
  return (
    <section className="border-t bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-20">
        <h2 className="text-center text-3xl font-bold tracking-tight">Roadmap</h2>
        <p className="mt-3 text-center text-gray-600">What shipped recently and what is coming next.</p>
        <ol className="mt-12 border-l pl-6">
          {roadmap.map((m) => (
            <li key={m.title} className="relative pb-10 last:pb-0">
              <span
                className={`absolute top-1.5 -left-7.75 size-3 rounded-full border-2 ${
                  m.state === "closed" ? "border-gray-900 bg-gray-900" : "border-gray-400 bg-white"
                }`}
              />
              <div className="flex flex-wrap items-baseline gap-x-3">
                <h3 className="font-semibold">{m.title}</h3>
                <span className="text-sm text-gray-500">
                  {m.state === "closed" ? "Shipped" : "Planned"} · {formatDate(m.due_on)}
                </span>
              </div>
              {m.description && <p className="mt-1 text-gray-600">{m.description}</p>}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
