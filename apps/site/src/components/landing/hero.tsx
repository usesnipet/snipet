import { useEffect, useState } from "react";

/** A plugin action the agent calls during a scripted run. */
type Tool = { plugin: string; icon: string; action: string };

/** A scripted agent run replayed by the hero demo, using plugins from the real catalog. */
type Scenario = { label: string; prompt: string; tools: Tool[]; reply: string };

const scenarios: Scenario[] = [
  {
    label: "Triage bugs",
    prompt: "Triage the bugs opened on GitHub this week.",
    tools: [
      { plugin: "GitHub", icon: "https://github.com/github.png", action: "search_issues" },
      { plugin: "Linear", icon: "https://github.com/linear.png", action: "create_issue" },
    ],
    reply:
      "5 new bugs this week. 3 come from the checkout API, so I filed them in Linear under Backend with links to the GitHub threads. The other 2 duplicate #412.",
  },
  {
    label: "Check a charge",
    prompt: "Why was order 8812 charged twice?",
    tools: [{ plugin: "Stripe", icon: "https://github.com/stripe.png", action: "search_payment_intents" }],
    reply:
      "The checkout page retried after a timeout and created a second payment intent 4 seconds later. Both succeeded. Refunding the second one will fix it.",
  },
  {
    label: "Search docs",
    prompt: "How do I rate limit a Cloudflare Worker?",
    tools: [{ plugin: "Cloudflare Docs", icon: "https://github.com/cloudflare.png", action: "search_cloudflare_documentation" }],
    reply:
      "Add a rate limiting binding in wrangler.toml, then call env.MY_LIMITER.limit({ key }) at the top of fetch and return 429 when success is false.",
  },
];

/** How long to hold a finished run before the demo moves on to the next scenario. */
const HOLD_MS = 4500;

/** Ticks of a run: the prompt, a start and a finish per tool, then one per reply word. */
const lengthOf = (s: Scenario) => 1 + s.tools.length * 2 + s.reply.split(" ").length;

/** Delay before tick `t` of a run; tool calls take longer than words so they read as real work. */
function delayFor(s: Scenario, t: number) {
  if (t === 0) return 300;
  if (t <= s.tools.length * 2) return t % 2 ? 450 : 900;
  return 28;
}

export function Hero() {
  const [index, setIndex] = useState(0);
  const [tick, setTick] = useState(0);
  // A click on a prompt takes over: the demo stops cycling and only replays what was picked.
  const [picked, setPicked] = useState(false);
  const scenario = scenarios[index];
  const total = lengthOf(scenario);

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTick(total);
      return;
    }
    if (tick < total) {
      const id = setTimeout(() => setTick(tick + 1), delayFor(scenario, tick));
      return () => clearTimeout(id);
    }
    if (picked) return;
    const id = setTimeout(() => {
      setIndex((index + 1) % scenarios.length);
      setTick(0);
    }, HOLD_MS);
    return () => clearTimeout(id);
  }, [tick, total, scenario, index, picked]);

  const pick = (i: number) => {
    setPicked(true);
    setIndex(i);
    setTick(0);
  };

  const toolTicks = scenario.tools.length * 2;
  const words = scenario.reply.split(" ");
  const shownWords = Math.max(0, tick - 1 - toolTicks);
  const running = tick < total;

  return (
    <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-20 pb-20 lg:grid-cols-[1.1fr_1fr] lg:pt-28">
      <div className="flex flex-col items-center gap-6 text-center lg:items-start lg:text-left">
        <p className="text-sm text-muted-foreground">Open source and self-hosted. Cloud is coming soon.</p>
        <h1 className="text-4xl font-bold tracking-tighter text-balance sm:text-6xl">
          Build AI agents that work across all your apps.
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          Connect agents to the tools you already use and call them from anywhere: your product, your backend, and
          soon the channels your users live in.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <a
            href="/docs/guides/local-setup/"
            className="rounded-lg bg-primary px-5 py-2.5 font-medium text-primary-foreground transition-transform hover:-translate-y-0.5"
          >
            Get started
          </a>
          <a
            href="https://github.com/usesnipet/snipet"
            className="rounded-lg border px-5 py-2.5 font-medium transition-colors hover:bg-accent"
          >
            Star on GitHub
          </a>
        </div>
      </div>

      <div className="w-full">
        <div className="overflow-hidden rounded-2xl border bg-card shadow-[0_24px_60px_-30px_oklch(0.3_0.02_250/0.45)]">
          <div className="flex items-center justify-between border-b px-4 py-3 text-sm">
            <span className="font-medium">Ops agent</span>
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className={`size-2 rounded-full ${running ? "animate-pulse bg-primary" : "bg-chart-2"}`} />
              {running ? "Working" : "Done"}
            </span>
          </div>

          {/* Screen readers get the finished run once instead of every streamed word. */}
          <p className="sr-only" aria-live="polite">
            {running ? "" : `${scenario.prompt} ${scenario.reply}`}
          </p>
          <div aria-hidden className="flex min-h-80 flex-col items-start gap-3 p-4 text-sm">
            {tick >= 1 && (
              <p className="hero-in max-w-[85%] self-end rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-primary-foreground">
                {scenario.prompt}
              </p>
            )}
            {scenario.tools.map((tool, i) => {
              if (tick < 2 + i * 2) return null;
              const done = tick >= 3 + i * 2;
              return (
                <div key={tool.action} className="hero-in flex max-w-full items-center gap-2.5 rounded-lg border bg-background px-3 py-2">
                  <img src={tool.icon} alt="" width="20" height="20" className="size-5 rounded" />
                  <p className="min-w-0 truncate">
                    <span className="text-muted-foreground">{tool.plugin}</span>{" "}
                    <code className="font-mono text-[0.8125rem]">{tool.action}</code>
                  </p>
                  {done ? (
                    <svg viewBox="0 0 16 16" className="size-4 shrink-0 text-chart-2" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m3.5 8.5 3 3 6-7" />
                    </svg>
                  ) : (
                    <span className="size-4 shrink-0 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
                  )}
                </div>
              );
            })}
            {shownWords > 0 && (
              <p className="max-w-[90%] leading-relaxed">
                {words.slice(0, shownWords).join(" ")}
                {running && <span className="ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 animate-pulse bg-foreground" />}
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-2 lg:justify-start">
          {scenarios.map((s, i) => (
            <button
              key={s.label}
              type="button"
              onClick={() => pick(i)}
              aria-pressed={i === index}
              className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                i === index ? "border-primary text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
