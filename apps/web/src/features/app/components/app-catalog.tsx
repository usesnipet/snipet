import { CatalogCard, CatalogList, CatalogListSkeleton } from "@/components/catalog";
import { DeleteDialog } from "@/components/confirm-dialog";
import { IconAction } from "@/components/icon-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputSearch } from "@/components/ui/input-search";
import { Skeleton } from "@/components/ui/skeleton";
import { useClipboard } from "@/hooks/use-clipboard";
import { useDialog } from "@/lib/dialog";
import { useDeleteApp, useListApiKey, useListApps } from "@snipet/client";
import { AppWindow, Copy, KeyRound, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import stc from "string-to-color";

import { AppDialog, AppFormDialog, AppTokenDialog } from "./dialogs";

import type { App } from "@snipet/shared";

export function AppCatalog() {
  const appsQuery = useListApps({ searchParams: { take: 500 } });
  // One request for every app's key count instead of one per card.
  const apiKeysQuery = useListApiKey();
  const [search, setSearch] = useState("");

  if (appsQuery.isLoading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-5">
        {/* Same toolbar slot as the loaded view, so the grid doesn't shift when the search box appears. */}
        <Skeleton className="h-10 w-full shrink-0 sm:ml-auto sm:w-72" />
        <CatalogListSkeleton size="md" />
      </div>
    );
  }
  if (appsQuery.isError) return <p className="text-destructive text-sm">Failed to load apps.</p>;

  const query = search.trim().toLowerCase();
  const apps = (appsQuery.data?.data ?? []).filter((app) => !query || app.name.toLowerCase().includes(query));
  const apiKeyCounts = new Map<string, number>();
  for (const apiKey of apiKeysQuery.data?.data ?? []) {
    apiKeyCounts.set(apiKey.appId, (apiKeyCounts.get(apiKey.appId) ?? 0) + 1);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <div className="flex shrink-0 sm:justify-end">
        <InputSearch
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search apps…"
          className="w-full sm:w-72"
        />
      </div>
      <div className="min-h-0 flex-1">
        <CatalogList
          items={apps}
          size="md"
          containerClassName="h-full"
          emptyMessage={query ? "No apps match your search." : "No apps yet."}
          renderItem={(app) => (
            <AppCard app={app} apiKeyCount={apiKeysQuery.isSuccess ? (apiKeyCounts.get(app.id) ?? 0) : undefined} />
          )}
        />
      </div>
    </div>
  );
}

/** Origin without its scheme, e.g. "app.example.com". */
const originHost = (origin: string) => origin.replace(/^https?:\/\//, "");

/** The app's origins and key count; `apiKeyCount` is undefined while keys load. */
function AppCard({ app, apiKeyCount }: { app: App; apiKeyCount?: number }) {
  const { openDialog } = useDialog();
  const { mutateAsync: deleteApp } = useDeleteApp();
  const { copy } = useClipboard();

  const openDelete = () =>
    openDialog({
      component: DeleteDialog,
      props: {
        title: "Delete app?",
        description: (
          <>
            <span className="font-medium text-foreground">{app.name}</span> and all its API keys and chats will be
            deleted. This action cannot be undone.
          </>
        ),
        confirmLabel: "Delete",
        onConfirm: () => deleteApp(app.id),
      },
    });

  const openDetails = () => openDialog({ component: AppDialog, props: { app } });
  const openEdit = () => openDialog({ component: AppFormDialog, props: { app } });
  const openTokenGenerate = () => openDialog({ component: AppTokenDialog, props: { app } });
  const [firstOrigin, ...otherOrigins] = app.allowedOrigins;

  return (
    <CatalogCard
      icon={
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-white"
          style={{ backgroundColor: stc(app.name) }}
        >
          <AppWindow className="size-5" />
        </span>
      }
      title={app.name}
      extraBadges={
        app.allowAnonymous && (
          <Badge variant="secondary" className="shrink-0 font-normal">
            Anonymous
          </Badge>
        )
      }
      description={
        firstOrigin ? `${originHost(firstOrigin)}${otherOrigins.length ? ` +${otherOrigins.length}` : ""}` : undefined
      }
      meta={
        <span className="flex flex-wrap gap-x-3">
          {!firstOrigin && (
            <span
              className="text-amber-700 dark:text-amber-400"
              title="Tokens are accepted from any site. Add origins to lock it."
            >
              Any origin
            </span>
          )}
          {apiKeyCount !== undefined && (
            <span className={apiKeyCount ? undefined : "text-amber-700 dark:text-amber-400"}>
              {apiKeyCount ? `${apiKeyCount} API ${apiKeyCount === 1 ? "key" : "keys"}` : "No API keys"}
            </span>
          )}
        </span>
      }
      onClick={openDetails}
      headerActions={
        <>
          <IconAction tooltip="Copy app ID">
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Copy ${app.name} app ID`}
              onClick={() => copy(app.id, { successTitle: "App ID copied", errorTitle: "Failed to copy app ID" })}
            >
              <Copy />
            </Button>
          </IconAction>
          <DropdownMenu>
            <IconAction tooltip="More actions">
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={`More actions for ${app.name}`}>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
            </IconAction>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={openEdit}>
                <Pencil />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={openTokenGenerate}>
                <KeyRound />
                Generate token
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={openDelete}>
                <Trash2 />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      }
    />
  );
}
