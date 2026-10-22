/** Catalog entry as read from the API's plugin and LLM manifests. */
export type Manifest = { key: string; name: string; icon: string; description: string };

export function Models({ models }: { models: Manifest[] }) {
  return (
    <section className="mx-auto max-w-5xl px-4 py-20 text-center">
      <h2 className="text-3xl font-bold tracking-tight">Any model, no lock-in</h2>
      <p className="mt-3 text-gray-600">Cloud providers or models running on your own hardware. Switch without rewriting the agent.</p>
      <ul className="mt-10 flex flex-wrap justify-center gap-3">
        {models.map((m) => (
          <li key={m.key} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
            {m.icon && <img src={m.icon} alt="" width="20" height="20" className="size-5 rounded" loading="lazy" />}
            {m.name}
          </li>
        ))}
      </ul>
    </section>
  );
}
