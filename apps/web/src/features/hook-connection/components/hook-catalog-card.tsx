import { CatalogCard } from "@/components/catalog";
import { Icon } from "@/components/icon";
import { useDialog } from "@/lib/dialog";
import { ArrowRight, Plus } from "lucide-react";

import { HookConnectionFormDialog } from "./hook-connection-form-dialog";
import { HookConnectionListDialog } from "./hook-connection-list-dialog";

import type { RegistryView } from "@/components/catalog";
import type { HookConnection, HookManifest } from "@snipet/shared";

type HookCatalogCardProps = {
  hook: HookManifest;
  view: RegistryView<HookConnection>;
};

export function HookCatalogCard({ hook, view }: HookCatalogCardProps) {
  const { connectionCount, connected } = view;
  const { openDialog } = useDialog();

  const countLabel =
    connectionCount === 0
      ? "No connections yet"
      : `${connectionCount} connection${connectionCount === 1 ? "" : "s"}`;

  const onClick = () => {
    if (connected) openDialog({ component: HookConnectionListDialog, props: { hook } });
    else openDialog({ component: HookConnectionFormDialog, props: { hook } });
  };

  return (
    <CatalogCard
      icon={<Icon name={hook.name} icon={hook.icon} />}
      title={hook.name}
      description={hook.description}
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
