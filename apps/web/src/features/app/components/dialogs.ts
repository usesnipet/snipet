import { lazyNamed } from "@/lib/lazy-named";

/**
 * This feature's dialogs, loaded on first open: their forms (and the schema
 * form library some use) stay out of the page's own bundle. `DialogContainer`
 * renders them under `Suspense`.
 */
export const AppFormDialog = lazyNamed(() => import("./app-form-dialog"), "AppFormDialog");
export const AppTokenDialog = lazyNamed(() => import("./app-token-dialog"), "AppTokenDialog");
export const AppDialog = lazyNamed(() => import("./app-dialog"), "AppDialog");
