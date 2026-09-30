import { QueryClientProvider } from "@tanstack/react-query";

import { Toaster } from "./components/ui/toaster";
import { TooltipProvider } from "./components/ui/tooltip";
import { ThemeProvider } from "./context/theme-provider";
import { DialogProvider } from "./lib/dialog/provider";
import { queryClient } from "./lib/query-client";

export function RootProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ThemeProvider>
            <DialogProvider>
              {children}
              <Toaster />
            </DialogProvider>
          </ThemeProvider>
        </TooltipProvider>
    </QueryClientProvider>
  )
}