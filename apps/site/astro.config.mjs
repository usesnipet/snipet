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
        { label: "Getting started", items: [{ slug: "docs" }, { slug: "docs/guides/local-setup" }] },
      ],
    }),
  ],
  vite: { plugins: [tailwindcss()] },
});
