// Mutations only describe their outcome; each app's QueryClient decides how to
// show it (the web app toasts it, see its lib/query-client.ts).
export type ClientMutationMeta = {
  successMessage?: string;
  errorMessage?: string;
};

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: ClientMutationMeta;
  }
}
