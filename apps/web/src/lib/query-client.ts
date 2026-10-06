import { toast } from "@/hooks/use-toast";
import { MutationCache, QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  // Hooks from @snipet/client describe their outcome in `meta`; the web app toasts it.
  mutationCache: new MutationCache({
    onSuccess: (_data, _variables, _context, mutation) => {
      const title = mutation.meta?.successMessage;
      if (title) toast({ title });
    },
    onError: (error, _variables, _context, mutation) => {
      const title = mutation.meta?.errorMessage;
      if (title) toast({ title, description: error.message, variant: "destructive" });
    },
  }),
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 5, // 5 minutes,
      retry: false,
    }
  }
});
