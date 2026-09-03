import { useTheme } from "@/context/theme-context";
import { MoonIcon, SunIcon } from "lucide-react";

import { Button } from "./button";

export function ToggleTheme() {
  const { setTheme, theme } = useTheme();

  const handleToggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  return (
    <Button variant="outline" size="icon" onClick={handleToggleTheme}>
      { theme === "dark" ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" /> }
    </Button>
  );
}