import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Builds one self-contained IIFE (`dist/widget.js`) that any site can load with a <script> tag.
// CSS is inlined into the bundle and injected into the widget's shadow root (see src/main.tsx).
export default defineConfig({
  plugins: [react()],
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
});
