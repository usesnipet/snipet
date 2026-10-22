import { createHighlighter } from "shiki";

// Top-level await runs once at build time; the component stays sync so React can render it on the server.
const highlighter = await createHighlighter({ themes: ["github-dark"], langs: ["html", "jsx", "typescript"] });

const scriptSnippet = `<script src="https://unpkg.com/@snipet/widget/dist/widget.js"></script>
<script>
  SnipetWidget.init({
    apiUrl: "https://snipet.example.com",
    appId: "<your app id>",
    agentId: "<your agent id>",
  });
</script>`;

const reactSnippet = `import { SnipetWidget } from "@snipet/react-widget";

<SnipetWidget
  apiUrl="https://snipet.example.com"
  appId="<your app id>"
  agentId="<your agent id>"
/>`;

const angularSnippet = `// app.config.ts
import { provideSnipet } from "@snipet/angular-widget";

export const appConfig: ApplicationConfig = {
  providers: [
    provideSnipet({
      apiUrl: "https://snipet.example.com",
      appId: "<your app id>",
      agentId: "<your agent id>",
      theme: "auto",
    }),
  ],
};`;

type Props = {
  caption: string;
  code: string;
  lang: "html" | "jsx" | "typescript";
  className?: string;
}
/** A captioned code sample. */
function Snippet({ caption, code, lang, className }: Props) {
  return (
    <figure className={`flex flex-col ${className ?? ""}`}>
      <figcaption className="mb-2 text-sm font-medium text-gray-500">{caption}</figcaption>
      <div
        // flex-1 + pre flex-1 stretch the block to the row height, so shorter samples match their neighbor.
        className="flex flex-1 flex-col [&_pre]:flex-1 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:p-4 [&_pre]:text-sm"
        dangerouslySetInnerHTML={{ __html: highlighter.codeToHtml(code, { lang, theme: "github-dark" }) }}
      />
    </figure>
  );
}

export function Channels() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20">
      <div className="text-center">
        <h2 className="text-3xl font-bold tracking-tight">Call your agents from anywhere</h2>
        <p className="mt-3 text-gray-600">
          Today: the API and an embeddable chat widget for any site, React or Angular. Next: external channels like
          WhatsApp, Telegram, Slack, Discord and more. The widget is just the first one.
        </p>
      </div>
      <div className="mt-10 grid gap-4 lg:grid-cols-2">
        <Snippet caption="Script tag" code={scriptSnippet} lang="html" className="lg:col-span-2" />
        <Snippet caption="React" code={reactSnippet} lang="jsx" />
        <Snippet caption="Angular" code={angularSnippet} lang="typescript" />
      </div>
    </section>
  );
}
