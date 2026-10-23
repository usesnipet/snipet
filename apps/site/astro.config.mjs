// @ts-check
import node from "@astrojs/node";
import react from "@astrojs/react";
import starlight from "@astrojs/starlight";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, memoryCache } from "astro/config";

export default defineConfig({
  // Pages stay prerendered; only routes with `prerender = false` (the landing) run on this server.
  adapter: node({ mode: "standalone" }),
  cache: { provider: memoryCache() },
  integrations: [
    react(),
    starlight({
      title: "Snipet",
      logo: { src: "./src/assets/logo.svg" },
      favicon: "/favicon.svg",
      // Dark code in both themes, like the landing's samples; rounded and flat like its code panels.
      expressiveCode: {
        themes: ["github-dark"],
        styleOverrides: { borderRadius: "0.75rem", frames: { frameBoxShadowCssValue: "none" } },
      },
      social: [{ icon: "github", label: "GitHub", href: "https://github.com/usesnipet/snipet" }],
      customCss: ["./src/styles/global.css"],
      // The landing page owns "/"; docs live under /docs.
      sidebar: [
        {
          label: "Get started",
          items: [{ slug: "docs" }, { slug: "docs/get-started/install" }, { slug: "docs/get-started/first-agent" }],
        },
        {
          label: "Concepts",
          items: ["models", "plugins", "agents", "apps"].map((page) => ({ slug: `docs/concepts/${page}` })),
        },
        {
          label: "Chat widget",
          items: [
            { slug: "docs/widget", label: "Overview" },
            ...["install", "configuration", "styling", "api"].map((page) => ({ slug: `docs/widget/${page}` })),
          ],
        },
        {
          label: "Identify your users",
          items: [
            { slug: "docs/auth", label: "How it works" },
            ...["anonymous", "issue-tokens", "use-token", "custom-ui"].map((page) => ({ slug: `docs/auth/${page}` })),
          ],
        },
      ],
    }),
  ],
  vite: { plugins: [tailwindcss()] },
});
