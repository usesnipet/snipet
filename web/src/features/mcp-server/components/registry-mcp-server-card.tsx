import { CatalogCard } from "@/components/catalog";
import { Icon } from "@/components/icon";
import { useDialog } from "@/lib/dialog";
import { Check, Plus } from "lucide-react";

import { InstallMcpServerDialog } from "./install-mcp-server-dialog";

import type { McpServerRegistryItem } from "../schemas";
type Props = {
  item: McpServerRegistryItem;
  installedCount: number;
};

export function RegistryMcpServerCard({ item, installedCount }: Props) {
  const { openDialog } = useDialog();
  const installed = installedCount > 0;

  return (
    <CatalogCard
      icon={<Icon name={item.name} icon={item.icon} />}
      title={item.name}
      description={item.description}
      tags={item.tags}
      meta={
        installed ? (
          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <Check className="size-3.5" />
            Installed{installedCount > 1 ? ` ×${installedCount}` : ""}
          </span>
        ) : item.transport === "http" ? "Remote · HTTP" : "Local · stdio"
      }
      cta={{
        label: installed ? "Add another" : "Install",
        icon: <Plus />,
        variant: installed ? "outline" : "default",
        onClick: () => openDialog({ component: InstallMcpServerDialog, props: { item, installedCount } }),
      }}
    />
  );
}
