import { useState } from "react";

import type { Manifest } from "../../lib/github";

/** Manifest tags about how a plugin is hosted, not what it does; useless as filters. */
const HIDDEN_TAGS = new Set(["remote", "official"]);

/** Tags shared by at least two plugins, so every filter narrows to a real group. */
function filtersOf(plugins: Manifest[]) {
  const counts = new Map<string, number>();
  for (const tag of plugins.flatMap((p) => p.tags ?? [])) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts].filter(([tag, n]) => n > 1 && !HIDDEN_TAGS.has(tag)).map(([tag]) => tag).sort();
}

export function Plugins({ plugins }: { plugins: Manifest[] }) {
  const [tag, setTag] = useState<string | null>(null);
  const shown = tag ? plugins.filter((p) => p.tags?.includes(tag)) : plugins;
  const filters = [null, ...filtersOf(plugins)];

  return (
    <section className="border-t bg-muted">
      <div className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-3xl font-bold tracking-tight">Plugins your agents can use</h2>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Start from the catalog or connect any MCP server. More integrations are on the roadmap.
        </p>

        <div className="mt-8 flex flex-wrap gap-2" role="group" aria-label="Filter plugins">
          {filters.map((t) => (
            <button
              key={t ?? "all"}
              type="button"
              onClick={() => setTag(t)}
              aria-pressed={tag === t}
              className={`rounded-full border px-3.5 py-1.5 text-sm capitalize transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                tag === t ? "border-primary bg-background text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t ?? "All"}
            </button>
          ))}
        </div>

        <ul className="mt-6 grid grid-cols-1 border-t sm:grid-cols-2 sm:gap-x-8 lg:grid-cols-3" aria-live="polite">
          {shown.map((p) => (
            <li key={p.key} className="flex items-center gap-3 border-b py-3">
              {p.icon && <img src={p.icon} alt="" width="28" height="28" className="size-7 rounded" loading="lazy" />}
              <div className="min-w-0">
                <h3 className="font-medium">{p.name}</h3>
                <p className="truncate text-sm text-muted-foreground" title={p.description}>
                  {p.description}
                </p>
              </div>
            </li>
          ))}
          <li className="flex items-center gap-3 border-b py-3">
            <span className="flex size-7 items-center justify-center rounded border border-dashed text-muted-foreground">+</span>
            <div>
              <h3 className="font-medium">Any MCP server</h3>
              <p className="text-sm text-muted-foreground">Bring your own server by URL.</p>
            </div>
          </li>
        </ul>
      </div>
    </section>
  );
}
