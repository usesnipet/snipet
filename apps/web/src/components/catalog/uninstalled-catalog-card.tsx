import { DeleteDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { useDialog } from "@/lib/dialog";
import { PackageX, Trash2 } from "lucide-react";

import { CatalogCard } from "./catalog-card";

import type { RegistryView } from "./registry-view";

type UninstalledCatalogCardProps = {
  view: RegistryView<{ id: string; name: string }>;
  /** Singular display name used mid-sentence, e.g. "plugin" or "LLM". */
  noun: string;
  /** Deletes one connection by id. */
  onDelete: (id: string) => Promise<unknown>;
};

/** A registry key that still has connections but whose manifest is gone: they can't run, only be removed. */
export function UninstalledCatalogCard({ view, noun, onDelete }: UninstalledCatalogCardProps) {
  const { openDialog } = useDialog();
  const count = view.connectionCount;
  const connectionsLabel = `${count} connection${count === 1 ? "" : "s"}`;

  const openRemove = () =>
    openDialog({
      component: DeleteDialog,
      props: {
        title: `Remove ${connectionsLabel}?`,
        description: (
          <>
            This permanently deletes{" "}
            <span className="font-medium text-foreground">
              {view.instances.map((connection) => connection.name).join(", ")}
            </span>
            . Agents using them lose access. This action cannot be undone.
          </>
        ),
        confirmLabel: "Remove",
        onConfirm: () => Promise.all(view.instances.map((connection) => onDelete(connection.id))),
      },
    });

  return (
    <CatalogCard
      className="border-dashed bg-muted/30 shadow-none"
      icon={
        <span className="text-muted-foreground flex size-6 items-center justify-center">
          <PackageX className="size-5" />
        </span>
      }
      title={view.key}
      extraBadges={
        <Badge
          variant="outline"
          className="shrink-0 border-amber-500/40 font-normal text-amber-700 dark:text-amber-400"
        >
          Not installed
        </Badge>
      }
      description={`This ${noun} isn't installed on the server anymore, so its connections can't run. Reinstall it to use them again, or remove them.`}
      meta={connectionsLabel}
      cta={{ label: "Remove", icon: <Trash2 />, variant: "outline", onClick: openRemove }}
    />
  );
}
