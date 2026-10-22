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
      social: [{ icon: "github", label: "GitHub", href: "https://github.com/usesnipet/snipet" }],
      customCss: ["./src/styles/global.css"],
      // The landing page owns "/"; docs live under /docs.
      sidebar: [
        { label: "Getting started", items: [{ slug: "docs" }, { slug: "docs/guides/local-setup" }] },
      ],
    }),
  ],
  vite: { plugins: [tailwindcss()] },
});
