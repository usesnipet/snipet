import { QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";

import { Toaster } from "./components/ui/toaster";
import { TooltipProvider } from "./components/ui/tooltip";
import { ThemeProvider } from "./context/theme-provider";
import { DialogProvider } from "./lib/dialog/provider";
import { queryClient } from "./lib/query-client";

export function RootProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {/* Honors the OS "reduce motion" setting: transforms are dropped, fades stay. */}
      <MotionConfig reducedMotion="user">
        <TooltipProvider>
          <ThemeProvider>
            <DialogProvider>
              {children}
              <Toaster />
            </DialogProvider>
          </ThemeProvider>
        </TooltipProvider>
      </MotionConfig>
    </QueryClientProvider>
  );
}
