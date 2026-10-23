import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

/** Sidebar groups, keyed by the docs path segment their pages live under. */
const sections: Record<string, string> = {
  "get-started": "Get started",
  concepts: "Concepts",
  widget: "Chat widget",
  auth: "Identify your users",
};

/** The llms.txt index (https://llmstxt.org): built from the docs collection so it can't drift from the pages. */
export const GET: APIRoute = async ({ site }) => {
  const docs = (await getCollection("docs")).sort((a, b) => a.id.localeCompare(b.id));
  const line = (d: (typeof docs)[number]) =>
    `- [${d.data.title}](${new URL(`/${d.id}/`, site).href}): ${d.data.description ?? ""}`;

  const body = [
    "# Snipet",
    "",
    "> Snipet is an open-source, self-hosted platform to build AI agents that use your tools (any LLM provider, plugins and MCP servers) and to put them in front of your users through an embeddable chat widget or the API.",
    "",
    "Snipet is one server plus a Postgres database, started with Docker Compose. Source code: https://github.com/usesnipet/snipet",
    "",
    ...Object.entries(sections).flatMap(([key, label]) => [
      `## ${label}`,
      "",
      // The section's overview page (e.g. docs/widget) sorts before its subpages; the introduction opens
      // "Get started", as in the sidebar.
      ...docs
        .filter((d) => d.id === `docs/${key}` || d.id.startsWith(`docs/${key}/`) || (key === "get-started" && d.id === "docs"))
        .map(line),
      "",
    ]),
    "## Optional",
    "",
    `- [Homepage](${new URL("/", site).href}): Overview, supported models and plugins, roadmap and FAQ.`,
    "",
  ].join("\n");

  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
