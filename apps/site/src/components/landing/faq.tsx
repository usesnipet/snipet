/** A question and its answer, shown on the page and repeated in the FAQPage JSON-LD, so they must match. */
type Question = { question: string; answer: string };

export const faqs: Question[] = [
  {
    question: "What is Snipet?",
    answer:
      "Snipet is an open-source platform to build AI agents that use your tools, and to put them in front of your users: in a chat widget on your site or through the API from your own product.",
  },
  {
    question: "Is Snipet free?",
    answer:
      "Yes. Snipet is open source and you can self-host it on your own servers at no cost. A hosted version, Snipet Cloud, is coming soon; join the waitlist to hear when it opens.",
  },
  {
    question: "Which LLM providers does Snipet support?",
    answer:
      "Cloud providers such as OpenAI, Google Gemini, Mistral AI, Groq, DeepSeek, xAI, Cerebras, Fireworks AI, OpenRouter and any OpenAI-compatible API, plus models running on your own hardware with Ollama or LM Studio. You can switch an agent's model without rewriting it.",
  },
  {
    question: "Can Snipet agents use MCP servers?",
    answer:
      "Yes. Pick a plugin from the catalog (GitHub, Linear, Stripe, Supabase, Neon and more) or connect any MCP server by its URL. Snipet fetches the server's actions, keeps them in sync and stores the credentials encrypted.",
  },
  {
    question: "How do I add an AI agent to my website?",
    answer:
      "Create an app in Snipet, then add the chat widget to your site with a script tag, the npm package, or the React and Angular libraries. To build your own interface instead, chat with the agent through the API.",
  },
  {
    question: "How do I self-host Snipet?",
    answer:
      "Snipet is one server plus a Postgres database. Download the docker-compose.yml from the repository, run docker compose up -d and open localhost:8852. You can also run it from source with Node.js 22 and pnpm.",
  },
  {
    question: "Do my users need an account to chat with an agent?",
    answer:
      "No. An app can let visitors chat anonymously, or your backend can issue a token that signs your existing users in to the widget.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-14 border-t">
      <div className="mx-auto max-w-3xl px-4 py-20">
        <h2 className="text-center text-3xl font-bold tracking-tight">Frequently asked questions</h2>
        <div className="mt-12 divide-y border-y">
          {faqs.map((f) => (
            <details key={f.question} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                <h3>{f.question}</h3>
                <span className="text-muted-foreground transition-transform group-open:rotate-45" aria-hidden="true">
                  +
                </span>
              </summary>
              <p className="mt-3 text-muted-foreground">{f.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
