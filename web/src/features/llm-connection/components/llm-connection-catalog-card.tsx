import { CatalogCard } from "@/components/catalog";
import { ArrowRight, Plus } from "lucide-react";

import { ProviderIcon } from "./provider-icon";

import type { RegistryView } from "../lib/registry-view";

export type LlmConnectionCatalogCardProps = {
  view: RegistryView;
};

export function LlmConnectionCatalogCard({ view }: LlmConnectionCatalogCardProps) {
  const { name, key, description, icon, tags, connectionCount, connected } = view;

  const countLabel =
    connectionCount === 0
      ? "No connections yet"
      : `${connectionCount} connection${connectionCount === 1 ? "" : "s"}`;

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
      }}
    />
  );
}
