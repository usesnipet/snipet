import { CatalogCard, CatalogList } from "@/components/catalog";
import { DeleteDialog } from "@/components/confirm-dialog";
import { LoadingFallback } from "@/components/loading-fallback";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { InputSearch } from "@/components/ui/input-search";
import { useDialog } from "@/lib/dialog";
import { AppWindow, KeyRound, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import stc from "string-to-color";

import { useDeleteApp, useListApps } from "@snipet/client";

import { AppFormDialog } from "./app-form-dialog";
import { AppTokenDialog } from "./app-token-dialog";

import type { App } from "@snipet/shared";

export function AppCatalog() {
  const appsQuery = useListApps({ searchParams: { take: 500 } });
  const [search, setSearch] = useState("");

  if (appsQuery.isLoading) return <LoadingFallback className="min-h-40" />;
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

  const openDelete = () => openDialog({
    component: DeleteDialog,
    props: {
      title: "Delete app?",
      description: (
        <>
          <span className="font-medium text-foreground">{app.name}</span> and all its API keys and
          sessions will be deleted. This action cannot be undone.
        </>
      ),
      confirmLabel: "Delete",
      onConfirm: () => deleteApp(app.id),
    },
  });

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
      headerActions={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openDialog({ component: AppFormDialog, props: { app } })}>
              <Pencil />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openDialog({ component: AppTokenDialog, props: { app } })}>
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
      }
    />
  );
}
