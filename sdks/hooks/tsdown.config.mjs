import { defineConfig } from "tsdown";

/** @snipet/shared is private, so its code and types go into dist; zod stays a peer. */
export default defineConfig({
  entry: ["src/index.ts"],
  format: "esm",
  dts: true,
  deps: { alwaysBundle: [/^@snipet\/shared/] },
});
