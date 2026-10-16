import { useSystemSettings } from "@/context/settings-context";
import { Bug } from "lucide-react";

/** Badge fixed on the top right of every signed-in page while debug mode is on. */
export function DebugModeBadge() {
  const { agentDebugEnabled } = useSystemSettings();
  if (!agentDebugEnabled) return null;

  return (
    <div className="pointer-events-none fixed top-0 right-0 z-50 gap-1 p-0.5 px-2 rounded-bl-md flex items-center bg-destructive">
      <Bug className="size-3" />
      Debug mode
    </div>
  );
}
