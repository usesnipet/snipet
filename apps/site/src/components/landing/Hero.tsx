export function Hero() {
  return (
    <section className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 pt-24 pb-20 text-center">
      <span className="rounded-full border px-3 py-1 text-sm text-gray-600">
        Open source · Self-hosted · Cloud coming soon
      </span>
      <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">Build AI agents that work across all your apps.</h1>
      <p className="text-lg text-gray-600">
        Connect agents to the tools you already use and call them from anywhere: your product, your backend, and soon
        the channels your users live in.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <a href="/docs/guides/local-setup/" className="rounded-lg bg-gray-900 px-5 py-2.5 font-medium text-white">
          Get started
        </a>
        <a href="https://github.com/usesnipet/snipet" className="rounded-lg border px-5 py-2.5 font-medium">
          Star on GitHub
        </a>
      </div>
    </section>
  );
}
