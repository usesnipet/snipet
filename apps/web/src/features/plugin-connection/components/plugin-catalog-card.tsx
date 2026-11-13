import { CatalogCard, ConnectionCount } from "@/components/catalog";
import { Icon } from "@/components/icon";
import { useDialog } from "@/lib/dialog";
import { ArrowRight, Plus } from "lucide-react";

import { capabilityLabels } from "../capabilities";
import { PluginConnectionFormDialog, PluginConnectionListDialog } from "./dialogs";

import type { RegistryView } from "@/components/catalog";
import type { PluginConnection } from "@snipet/shared";
import type { PluginManifest } from "@snipet/shared/core";

type PluginCatalogCardProps = {
  plugin: PluginManifest;
  view: RegistryView<PluginConnection>;
};

export function PluginCatalogCard({ plugin, view }: PluginCatalogCardProps) {
  const { instances, connected } = view;
  const { openDialog } = useDialog();

  const onClick = () => {
    if (connected) openDialog({ component: PluginConnectionListDialog, props: { plugin } });
    else openDialog({ component: PluginConnectionFormDialog, props: { plugin, openListOnCreate: true } });
  };

  return (
    <CatalogCard
      icon={<Icon name={plugin.name} icon={plugin.icon} />}
      title={plugin.name}
      description={plugin.description}
      badges={capabilityLabels(plugin)}
      tags={view.tags}
      meta={<ConnectionCount connections={instances} />}
      onClick={onClick}
      cta={{
        label: connected ? "Manage" : "Connect",
        icon: connected ? <ArrowRight /> : <Plus />,
        variant: connected ? "outline" : "default",
        onClick,
      }}
    />
  );
}
