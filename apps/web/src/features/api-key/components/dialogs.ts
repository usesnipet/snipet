import { lazyNamed } from "@/lib/lazy-named";

/**
 * This feature's dialogs, loaded on first open: their forms (and the schema
 * form library some use) stay out of the page's own bundle. `DialogContainer`
 * renders them under `Suspense`.
 */
export const CreateApiKeyDialog = lazyNamed(() => import("./create-api-key-dialog"), "CreateApiKeyDialog");
export const UpdateApiKeyExpirationDialog = lazyNamed(
  () => import("./update-api-key-expiration-dialog"),
  "UpdateApiKeyExpirationDialog",
);
