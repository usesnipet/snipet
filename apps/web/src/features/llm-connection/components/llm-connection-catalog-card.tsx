import { CatalogCard, ConnectionCount } from "@/components/catalog";
import { Icon } from "@/components/icon";
import { useDialog } from "@/lib/dialog";
import { ArrowRight, Plus } from "lucide-react";

import { CreateLlmConnectionDialog, LlmConnectionListDialog } from "./dialogs";

import type { RegistryView } from "@/components/catalog";
import type { LlmConnection } from "@snipet/shared";

export type LlmConnectionCatalogCardProps = {
  view: RegistryView<LlmConnection>;
};

export function LlmConnectionCatalogCard({ view }: LlmConnectionCatalogCardProps) {
  const { name, key, description, icon, tags, instances, connected } = view;
  const { openDialog } = useDialog();

  const onClick = () => {
    if (connected) {
      openDialog({
        component: LlmConnectionListDialog,
        props: { llm: { name, key } },
      });
    } else {
      openDialog({
        component: CreateLlmConnectionDialog,
        props: { defaultValues: { llmKey: key } },
      });
    }
  };

  return (
    <CatalogCard
      icon={<Icon name={name} icon={icon} />}
      title={name}
      description={description}
      tags={tags}
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
