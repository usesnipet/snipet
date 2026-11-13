import { lazyNamed } from "@/lib/lazy-named";

/**
 * This feature's dialogs, loaded on first open: their forms (and the schema
 * form library some use) stay out of the page's own bundle. `DialogContainer`
 * renders them under `Suspense`.
 */
export const PluginConnectionFormDialog = lazyNamed(
  () => import("./plugin-connection-form-dialog"),
  "PluginConnectionFormDialog",
);
export const PluginConnectionListDialog = lazyNamed(
  () => import("./plugin-connection-list-dialog"),
  "PluginConnectionListDialog",
);
