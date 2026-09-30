import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";
import { Wrench } from "lucide-react";

import type { Tool } from "@snipet/shared";
type Props = {
  tool: Tool;
  /** Registry icon of the tool's MCP server, if it was installed from the registry. */
  serverIcon?: string;
  className?: string;
};

export function ToolIcon({ tool, serverIcon, className }: Props) {
  if (tool.mcpServer) {
    return <Icon name={tool.mcpServer.name} icon={serverIcon} className={className} />;
  }
  return (
    <div className={cn("bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg", className)}>
      <Wrench className="size-4" />
    </div>
  );
}
