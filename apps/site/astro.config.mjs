// @ts-check
import react from "@astrojs/react";
import starlight from "@astrojs/starlight";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
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
