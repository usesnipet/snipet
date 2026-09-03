import { useTheme } from "@/context/theme-context";
import { cn } from "@/lib/utils";
import { MoonIcon, SunIcon } from "lucide-react";

import { Button } from "./button";

export function ToggleTheme({ className }: { className?: string }) {
  const { setTheme, theme } = useTheme();

  const handleToggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={handleToggleTheme}
      aria-label="Toggle theme"
      className={cn("text-sidebar-foreground/50 hover:text-sidebar-foreground", className)}
    >
      {theme === "dark" ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
    </Button>
  );
}
