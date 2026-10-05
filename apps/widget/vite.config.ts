import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Builds one self-contained IIFE (`dist/widget.js`) that any site can load with a <script> tag.
// CSS is inlined into the bundle and injected into the widget's shadow root (see src/main.tsx).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    lib: {
      entry: "src/main.tsx",
      name: "SnipetWidget",
      formats: ["iife"],
      fileName: () => "widget.js",
    },
  },
});
