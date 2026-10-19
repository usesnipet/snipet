import { readFileSync } from "node:fs";

import { defineConfig } from "vite";

const { version } = JSON.parse(readFileSync(new URL("package.json", import.meta.url), "utf8"));

// Two builds from one config:
// - default: one self-contained IIFE (`dist/widget.js`) that any site loads with a <script> tag.
//   CSS is inlined into the bundle and injected into the widget's shadow root (see src/main.tsx).
// - `--mode loader`: the npm entry (`dist/loader.js`), which loads that IIFE from the CDN.
export default defineConfig(({ mode }) =>
  mode === "loader"
    ? {
        define: { __WIDGET_VERSION__: JSON.stringify(version) },
        build: {
          emptyOutDir: false,
          lib: { entry: "src/loader.ts", formats: ["es"], fileName: () => "loader.js" },
        },
      }
    : {
        // Preact instead of React: same components, a fraction of react-dom's size.
        resolve: {
          alias: {
            "react-dom/client": "preact/compat/client",
            "react-dom": "preact/compat",
            "react/jsx-runtime": "preact/jsx-runtime",
            "react/jsx-dev-runtime": "preact/jsx-runtime",
            react: "preact/compat",
          },
        },
        define: { "process.env.NODE_ENV": JSON.stringify("production") },
        build: {
          // light-dark() (theme colors) must ship as-is: the lightningcss fallback for older
          // targets breaks it inside custom properties. Supported since Chrome 123 / Firefox 120 / Safari 17.5.
          cssTarget: ["chrome123", "firefox120", "safari17.5"],
          lib: {
            entry: "src/main.tsx",
            name: "SnipetWidget",
            formats: ["iife"],
            fileName: () => "widget.js",
          },
        },
        server: {
          port: 5174,
        },
      },
);
