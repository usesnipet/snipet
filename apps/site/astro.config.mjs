// @ts-check
import node from "@astrojs/node";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import starlight from "@astrojs/starlight";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, envField, memoryCache } from "astro/config";

/**
 * Public origin of the site. Read at build time, since the docs, sitemap and llms.txt are prerendered; the
 * `PUBLIC_` prefix is what makes Turborepo pass it through to the build.
 */
const site = process.env.PUBLIC_SITE_URL || "https://snipet.dev";

export default defineConfig({
  // Canonical links, og:url and the sitemap are only generated when this is set.
  site,
  // Pages stay prerendered; only routes with `prerender = false` (the landing) run on this server.
  adapter: node({ mode: "standalone" }),
  cache: { provider: memoryCache() },
  env: {
    schema: {
      // Public by design (it ends up in the page), but "secret" is what makes Astro read it at runtime
      // instead of inlining it at build time, so one image serves any key.
      WEB3FORMS_ACCESS_KEY: envField.string({ context: "server", access: "secret" }),
    },
  },
  integrations: [
    react(),
    // Replaces the sitemap Starlight adds on its own, to keep the noindex confirmation page out of it.
    sitemap({ filter: (page) => !page.includes("/waitlist") }),
    starlight({
      title: "Snipet",
      logo: { src: "./src/assets/logo.svg" },
      favicon: "/favicon.svg",
      head: [{ tag: "meta", attrs: { property: "og:image", content: new URL("/og.png", site).href } }],
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
