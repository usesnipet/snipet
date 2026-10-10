import { CatalogCard } from "@/components/catalog";
import { Icon } from "@/components/icon";
import { useDialog } from "@/lib/dialog";
import { ArrowRight, Plus } from "lucide-react";

import { PluginConnectionFormDialog } from "./plugin-connection-form-dialog";
import { PluginConnectionListDialog } from "./plugin-connection-list-dialog";

import type { RegistryView } from "@/components/catalog";
import type { PluginConnection, PluginManifest } from "@snipet/shared";

type PluginCatalogCardProps = {
  plugin: PluginManifest;
  view: RegistryView<PluginConnection>;
};

export function PluginCatalogCard({ plugin, view }: PluginCatalogCardProps) {
  const { connectionCount, connected } = view;
  const { openDialog } = useDialog();

  const countLabel =
    connectionCount === 0
      ? "No connections yet"
      : `${connectionCount} connection${connectionCount === 1 ? "" : "s"}`;

  const onClick = () => {
    if (connected) openDialog({ component: PluginConnectionListDialog, props: { plugin } });
    else openDialog({ component: PluginConnectionFormDialog, props: { plugin } });
  };

  return (
    <CatalogCard
      icon={<Icon name={plugin.name} icon={plugin.icon} />}
      title={plugin.name}
      description={plugin.description}
      tags={view.tags}
      meta={countLabel}
      cta={{
        label: connected ? "Configure" : "Connect",
        icon: connected ? <ArrowRight /> : <Plus />,
        variant: connected ? "outline" : "default",
        onClick,
      }}
    />
  );
}
