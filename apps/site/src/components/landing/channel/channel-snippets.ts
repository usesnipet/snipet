/** Code samples for the Channels section; kept out of the .astro frontmatter, whose compiler hoists `export` lines it finds even inside strings. */

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

/** The samples shown, in grid order; `wide` spans both columns. */
export const snippets = [
  { caption: "Script tag", code: scriptSnippet, lang: "html" as const, wide: true },
  { caption: "React", code: reactSnippet, lang: "jsx" as const },
  { caption: "Angular", code: angularSnippet, lang: "typescript" as const },
];
