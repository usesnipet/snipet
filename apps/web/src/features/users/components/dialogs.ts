import { lazyNamed } from "@/lib/lazy-named";

/**
 * This feature's dialogs, loaded on first open: their forms (and the schema
 * form library some use) stay out of the page's own bundle. `DialogContainer`
 * renders them under `Suspense`.
 */
export const CreateUserDialog = lazyNamed(() => import("./create-user-dialog"), "CreateUserDialog");
export const UpdateUserDialog = lazyNamed(() => import("./update-user-dialog"), "UpdateUserDialog");
