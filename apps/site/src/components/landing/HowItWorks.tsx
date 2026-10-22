const steps = [
  { title: "Connect a model", text: "Add a provider: OpenAI, Gemini, Mistral, Groq, OpenRouter, or run models locally with Ollama and LM Studio." },
  { title: "Enable plugins", text: "Turn on integrations from the catalog or point to any MCP server. Credentials are stored encrypted." },
  { title: "Create an agent", text: "Give it a prompt, pick its model and choose which plugins it may use." },
  { title: "Use it anywhere", text: "Call it through the API or drop the chat widget into your app. External channels are next." },
];

export function HowItWorks() {
  return (
    <section className="border-t bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-20">
        <h2 className="text-center text-3xl font-bold tracking-tight">How it works</h2>
        <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <li key={step.title} className="rounded-xl border bg-white p-6">
              <span className="text-sm font-semibold text-gray-400">0{i + 1}</span>
              <h3 className="mt-2 font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-gray-600">{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
