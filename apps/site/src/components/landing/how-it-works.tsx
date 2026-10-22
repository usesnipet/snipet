/** A setup step, with a sample of what it produces in the app; the samples build the hero's Ops agent. */
type Step = { title: string; text: string; sample: { icons: string[]; label: string } };

const steps: Step[] = [
  {
    title: "Connect a model",
    text: "Add a provider: OpenAI, Gemini, Mistral, Groq, OpenRouter, or run models locally with Ollama and LM Studio.",
    sample: { icons: ["https://openrouter.ai/favicon.ico"], label: "gpt-4.1 via OpenRouter" },
  },
  {
    title: "Enable plugins",
    text: "Turn on integrations from the catalog or point to any MCP server. Credentials are stored encrypted.",
    sample: { icons: ["https://github.com/github.png", "https://github.com/linear.png"], label: "GitHub, Linear" },
  },
  {
    title: "Create an agent",
    text: "Give it a prompt, pick its model and choose which plugins it may use.",
    sample: { icons: [], label: "Ops agent" },
  },
  {
    title: "Use it anywhere",
    text: "Call it through the API or drop the chat widget into your app. External channels are next.",
    sample: { icons: [], label: "Widget on your site" },
  },
];

export function HowItWorks() {
  return (
    <section className="border-t bg-muted">
      <div className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-3xl font-bold tracking-tight">From zero to a working agent</h2>
        <p className="mt-3 max-w-xl text-muted-foreground">Four steps in the app, no code until you embed it.</p>
        {/* Each step but the last draws the connector to the next: down on mobile, across on desktop. */}
        <ol className="mt-12 grid gap-10 lg:grid-cols-4 lg:gap-8">
          {steps.map((step, i) => (
            <li
              key={step.title}
              className="relative pl-12 after:absolute after:top-10 after:-bottom-8 after:left-4 after:w-px after:bg-border last:after:hidden lg:pt-12 lg:pl-0 lg:after:top-4 lg:after:right-[-2rem] lg:after:bottom-auto lg:after:left-10 lg:after:h-px lg:after:w-auto"
            >
              <span className="absolute top-0 left-0 flex size-8 items-center justify-center rounded-full border bg-background text-sm font-semibold">
                {i + 1}
              </span>
              <h3 className="font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{step.text}</p>
              <span className="mt-4 inline-flex items-center gap-2 rounded-lg border bg-background px-2.5 py-1.5 text-sm">
                {step.sample.icons.map((src) => (
                  <img key={src} src={src} alt="" width="16" height="16" className="size-4 rounded-sm" loading="lazy" />
                ))}
                {step.sample.label}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
