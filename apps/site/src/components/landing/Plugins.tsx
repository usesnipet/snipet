import type { Manifest } from "./Models";

export function Plugins({ plugins }: { plugins: Manifest[] }) {
  return (
    <section className="border-t bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-20 text-center">
        <h2 className="text-3xl font-bold tracking-tight">Plugins your agents can use</h2>
        <p className="mt-3 text-gray-600">Start from the catalog or connect any MCP server. More integrations are on the roadmap.</p>
        <ul className="mt-10 grid gap-3 text-left sm:grid-cols-2 lg:grid-cols-3">
          {plugins.map((p) => (
            <li key={p.key} className="flex gap-3 rounded-xl border bg-white p-4">
              {p.icon && <img src={p.icon} alt="" width="32" height="32" className="size-8 rounded" loading="lazy" />}
              <div>
                <h3 className="font-medium">{p.name}</h3>
                <p className="text-sm text-gray-600">{p.description}</p>
              </div>
            </li>
          ))}
          <li className="flex items-center gap-3 rounded-xl border border-dashed bg-white p-4">
            <div>
              <h3 className="font-medium">Any MCP server</h3>
              <p className="text-sm text-gray-600">Bring your own server by URL.</p>
            </div>
          </li>
        </ul>
      </div>
    </section>
  );
}
