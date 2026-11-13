import { lazyNamed } from "@/lib/lazy-named";

/**
 * This feature's dialogs, loaded on first open: their forms (and the schema
 * form library some use) stay out of the page's own bundle. `DialogContainer`
 * renders them under `Suspense`.
 */
export const CreateLlmConnectionDialog = lazyNamed(
  () => import("./create-llm-connection-dialog"),
  "CreateLlmConnectionDialog",
);
export const LlmConnectionListDialog = lazyNamed(
  () => import("./llm-connection-list-dialog"),
  "LlmConnectionListDialog",
);
export const TestLlmConnectionDialog = lazyNamed(
  () => import("./test-llm-connection-dialog"),
  "TestLlmConnectionDialog",
);
