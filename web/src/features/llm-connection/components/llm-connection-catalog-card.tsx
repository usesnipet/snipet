import { CatalogCard } from "@/components/catalog";
import { useDialog } from "@/lib/dialog";
import { ArrowRight, Plus } from "lucide-react";

import { LlmConnectionListFromProviderDialog } from "./connection-list-from-provider-dialog";
import { CreateLlmConnectionDialog } from "./create-llm-connection-dialog";
import { ProviderIcon } from "./provider-icon";

import type { RegistryView } from "../lib/registry-view";
export type LlmConnectionCatalogCardProps = {
  view: RegistryView;
};

export function LlmConnectionCatalogCard({ view }: LlmConnectionCatalogCardProps) {
  const { name, key, description, icon, tags, connectionCount, connected } = view;
  const { openDialog } = useDialog();

  const countLabel =
    connectionCount === 0
      ? "No connections yet"
      : `${connectionCount} connection${connectionCount === 1 ? "" : "s"}`;

  const onClick = () => {
    if (connected) {
      console.log("configure");
      openDialog({
        component: LlmConnectionListFromProviderDialog,
        props: { provider: { name, key } }
      })
    } else {
      openDialog({
        component: CreateLlmConnectionDialog,
        props: { defaultValues: { provider: key } }
      });
    }
  }

  return (
    <CatalogCard
      icon={<ProviderIcon name={name} providerKey={key} icon={icon} />}
      title={name}
      description={description}
      tags={tags}
      meta={countLabel}
      cta={{
        label: connected ? "Configure" : "Connect",
        icon: connected ? <ArrowRight /> : <Plus />,
        variant: connected ? "outline" : "default",
        onClick
      }}
    />
  );
}
