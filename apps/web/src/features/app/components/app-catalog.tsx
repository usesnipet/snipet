import { CatalogCard, CatalogList, CatalogListSkeleton } from "@/components/catalog";
import { Skeleton } from "@/components/ui/skeleton";
import { DeleteDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputSearch } from "@/components/ui/input-search";
import { useClipboard } from "@/hooks/use-clipboard";
import { useDialog } from "@/lib/dialog";
import { useDeleteApp, useListApps } from "@snipet/client";
import { AppWindow, Copy, KeyRound, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import stc from "string-to-color";

import { AppFormDialog, AppTokenDialog } from "./dialogs";

import type { App } from "@snipet/shared";

export function AppCatalog() {
  const appsQuery = useListApps({ searchParams: { take: 500 } });
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
          renderItem={(app) => <AppCard app={app} />}
        />
      </div>
    </div>
  );
}

function AppCard({ app }: { app: App }) {
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
            <span className="font-medium text-foreground">{app.name}</span> and all its API keys and sessions will be
            deleted. This action cannot be undone.
          </>
        ),
        confirmLabel: "Delete",
        onConfirm: () => deleteApp(app.id),
      },
    });

  const openEdit = () => openDialog({ component: AppFormDialog, props: { app } });
  const openTokenGenerate = () => openDialog({ component: AppTokenDialog, props: { app } });
  const origins = app.allowedOrigins.length;

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
      updatedAt={app.updatedAt.toISOString()}
      meta={origins ? `${origins} allowed origin${origins === 1 ? "" : "s"}` : "Any origin"}
      onClick={openEdit}
      headerActions={
        <>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Copy agent ID"
            title="Copy agent ID"
            onClick={() => copy(app.id, { successTitle: "App ID copied", errorTitle: "Failed to copy app ID" })}
          >
            <Copy />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
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
