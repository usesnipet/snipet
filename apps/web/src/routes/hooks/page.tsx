import { RegistryCatalog } from "@/components/catalog";
import { Page } from "@/components/page";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { HookCatalogCard } from "@/features/hook-connection/components/hook-catalog-card";
import { FlaskConical } from "lucide-react";
import { useMemo } from "react";

import { useHookManifests, useListHookConnections } from "@snipet/client";

import type { HookConnection } from "@snipet/shared";

const hookKeyOf = (connection: HookConnection) => connection.hookKey;

export const HooksPage = () => {
  const hooks = useHookManifests();
  const connections = useListHookConnections();
  const byKey = useMemo(() => new Map(hooks.data?.map((h) => [h.key, h])), [hooks.data]);

  return (
    <Page title="Hooks" description="Run your own code or services at points of the agent loop." documentTitle="Hooks">
      <Alert className="mb-6 rounded-lg">
        <FlaskConical className="size-4" />
        <AlertTitle>Experimental</AlertTitle>
        <AlertDescription className="text-muted-foreground">
          Hooks are in an early stage: the events, payloads and reply format may change between releases.
        </AlertDescription>
      </Alert>
      <RegistryCatalog
        registry={hooks.data ?? []}
        connections={connections.data?.data ?? []}
        keyOf={hookKeyOf}
        isLoading={hooks.isLoading || connections.isLoading}
        isError={hooks.isError || connections.isError}
        noun="hooks"
        renderItem={(view) => <HookCatalogCard hook={byKey.get(view.key)!} view={view} />}
      />
    </Page>
  );
};
