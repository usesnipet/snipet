import { ConfirmDialog, DeleteDialog } from "@/components/confirm-dialog";
import { IconAction } from "@/components/icon-action";
import { SecretKeyDialog } from "@/components/secret-key-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDialog } from "@/lib/dialog";
import { useDeleteApiKey, useRollApiKey } from "@snipet/client";
import { CalendarClock, MoreHorizontal, RefreshCw, Trash2 } from "lucide-react";
import moment from "moment";

import { UpdateApiKeyExpirationDialog } from "./dialogs";

import type { ApiKey } from "@snipet/shared";

/** One API key of an app: name, key prefix, expiry and its actions. */
export function ApiKeyRow({ apiKey }: { apiKey: ApiKey }) {
  const { openDialog } = useDialog();
  const { mutateAsync: rollApiKey } = useRollApiKey();
  const { mutateAsync: deleteApiKey } = useDeleteApiKey();
  const isExpired = !!apiKey.expiresAt && moment(apiKey.expiresAt).isBefore();

  const openExpiration = () => openDialog({ component: UpdateApiKeyExpirationDialog, props: { apiKey } });

  const openRoll = () =>
    openDialog({
      component: ConfirmDialog,
      props: {
        title: "Roll API key?",
        description: (
          <>
            This will generate a new secret for <span className="font-medium text-foreground">{apiKey.name}</span>. The
            previous secret will stop working immediately.
          </>
        ),
        confirmLabel: "Roll key",
        destructive: true,
        onConfirm: async () => {
          const rolled = await rollApiKey({ id: apiKey.id });
          openDialog({
            component: SecretKeyDialog,
            props: {
              secret: rolled.key,
              title: "API key rolled",
              description: "Copy this key now and update your backend. It will not be shown again.",
            },
          });
        },
      },
    });

  const openDelete = () =>
    openDialog({
      component: DeleteDialog,
      props: {
        title: "Delete API key?",
        description: (
          <>
            <span className="font-medium text-foreground">{apiKey.name}</span> stops working right away. Backends using
            it can no longer issue tokens. This action cannot be undone.
          </>
        ),
        onConfirm: () => deleteApiKey({ id: apiKey.id }),
      },
    });

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium leading-none">{apiKey.name}</span>
          {!apiKey.active && <Badge variant="outline">Disabled</Badge>}
          {isExpired && <Badge variant="destructive">Expired</Badge>}
        </div>
        <span className="text-muted-foreground truncate text-xs">
          <span className="font-mono">{apiKey.keyId}</span>
          {" · "}
          {apiKey.expiresAt
            ? `${isExpired ? "Expired" : "Expires"} ${moment(apiKey.expiresAt).fromNow()}`
            : "Never expires"}
        </span>
      </div>
      <DropdownMenu>
        <IconAction tooltip="More actions">
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`More actions for ${apiKey.name}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
        </IconAction>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={openExpiration}>
            <CalendarClock />
            Update expiration
          </DropdownMenuItem>
          <DropdownMenuItem onClick={openRoll}>
            <RefreshCw />
            Roll key
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={openDelete}>
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
