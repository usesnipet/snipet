import { IconAction } from "@/components/icon-action";
import { Button } from "@/components/ui/button";
import {
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiKeyRow } from "@/features/api-key/components/api-key-row";
import { CreateApiKeyDialog } from "@/features/api-key/components/dialogs";
import { useClipboard } from "@/hooks/use-clipboard";
import { useDialog } from "@/lib/dialog";
import { useListApiKey } from "@snipet/client";
import { MAX_TAKE } from "@snipet/shared";
import { Copy } from "lucide-react";

import { AppFormDialog } from "./dialogs";

import type { App } from "@snipet/shared";
import type { DialogInstanceProps } from "@/lib/dialog";

type AppDialogProps = DialogInstanceProps<{
  app: App;
  /** Opened right after creating the app: the title says so and points to the next step. */
  isNew?: boolean;
}>;

/** One app at a glance: its ID, where it runs, who can chat, and the API keys its backend uses. */
export function AppDialog({ app, isNew }: AppDialogProps) {
  const { openDialog } = useDialog();
  const { copy } = useClipboard();
  const apiKeysQuery = useListApiKey({ searchParams: { appId: app.id, take: MAX_TAKE, skip: 0 } });
  const apiKeys = apiKeysQuery.data?.data ?? [];
  const isEmpty = apiKeysQuery.isSuccess && apiKeys.length === 0;

  const openEdit = () => openDialog({ component: AppFormDialog, props: { app } });
  const openCreateKey = () => openDialog({ component: CreateApiKeyDialog, props: { app } });

  return (
    <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{isNew ? `${app.name} created` : app.name}</DialogTitle>
        <DialogDescription>
          {isNew
            ? "Next, create an API key for your backend, or copy the app ID for the widget."
            : "Where the app runs, who can chat, and the keys your backend uses."}
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-6">
        <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-6 gap-y-3 text-sm">
          <dt className="text-muted-foreground">App ID</dt>
          <dd className="flex min-w-0 items-center gap-1">
            <code className="truncate font-mono text-xs">{app.id}</code>
            <IconAction tooltip="Copy app ID">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Copy app ID"
                onClick={() => copy(app.id, { successTitle: "App ID copied", errorTitle: "Failed to copy app ID" })}
              >
                <Copy />
              </Button>
            </IconAction>
          </dd>
          <dt className="text-muted-foreground">Allowed origins</dt>
          <dd className="min-w-0">
            {app.allowedOrigins.length ? (
              <ul className="flex flex-col gap-1">
                {app.allowedOrigins.map((origin) => (
                  <li key={origin} className="truncate">
                    {origin}
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-amber-700 dark:text-amber-400">
                Any site. Add origins to lock browser access to your sites.
              </span>
            )}
          </dd>
          <dt className="text-muted-foreground">Anonymous users</dt>
          <dd>{app.allowAnonymous ? "Allowed, visitors chat without signing in" : "Off, users need a token"}</dd>
        </dl>

        <section className="flex flex-col gap-2" aria-labelledby="app-api-keys">
          <h3 id="app-api-keys" className="text-sm font-medium">
            API keys
          </h3>
          {apiKeysQuery.isLoading && [0, 1].map((index) => <Skeleton key={index} className="h-15 w-full rounded-lg" />)}
          {apiKeysQuery.isError && (
            <div className="flex items-center gap-3 py-2">
              <p className="text-destructive text-sm">Failed to load API keys.</p>
              <Button
                variant="outline"
                size="sm"
                disabled={apiKeysQuery.isFetching}
                onClick={() => void apiKeysQuery.refetch()}
              >
                Try again
              </Button>
            </div>
          )}
          {isEmpty && (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-6 text-center">
              <div>
                <p className="font-medium">No API keys</p>
                <p className="text-muted-foreground text-sm">
                  Your backend needs one to issue tokens for signed-in users.
                </p>
              </div>
              <Button type="button" size="sm" onClick={openCreateKey}>
                New API key
              </Button>
            </div>
          )}
          {apiKeys.map((apiKey) => (
            <ApiKeyRow key={apiKey.id} apiKey={apiKey} />
          ))}
        </section>
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Close
          </Button>
        </DialogClose>
        <Button type="button" variant="outline" onClick={openEdit}>
          Edit app
        </Button>
        {!isEmpty && (
          <Button type="button" onClick={openCreateKey}>
            New API key
          </Button>
        )}
      </DialogFooter>
    </DialogContent>
  );
}
