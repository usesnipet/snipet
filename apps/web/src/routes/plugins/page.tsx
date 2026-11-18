import { RegistryCatalog, UninstalledCatalogCard } from "@/components/catalog";
import { Page } from "@/components/page";
import { PluginCatalogCard } from "@/features/plugin-connection/components/plugin-catalog-card";
import { PluginConnectionListDialog } from "@/features/plugin-connection/components/dialogs";
import { useOAuthReturn } from "@/features/plugin-connection/oauth";
import { useDialog } from "@/lib/dialog";
import { useEffect, useMemo, useRef } from "react";

import { useDeletePluginConnection, useListPluginConnections, usePlugins } from "@snipet/client";

import type { PluginConnection } from "@snipet/shared";

const pluginKeyOf = (connection: PluginConnection) => connection.pluginKey;

export const PluginsPage = () => {
  const plugins = usePlugins();
  const connections = useListPluginConnections();
  const { mutateAsync: deleteConnection } = useDeletePluginConnection();
  const byKey = useMemo(() => new Map(plugins.data?.map((p) => [p.key, p])), [plugins.data]);
  const { openDialog } = useDialog();

  // Back from an OAuth provider: reopen the plugin's connections once they're loaded, where the new status shows.
  // A ref, not state: the effect below runs right after the return is read, and again when the data arrives.
  const returnedId = useRef<string>(undefined);
  useOAuthReturn((connectionId) => (returnedId.current = connectionId));
  useEffect(() => {
    if (!returnedId.current || !connections.data || !plugins.data) return;
    const pluginKey = connections.data.data.find((c) => c.id === returnedId.current)?.pluginKey;
    const plugin = pluginKey && byKey.get(pluginKey);
    if (plugin) openDialog({ component: PluginConnectionListDialog, props: { plugin } });
    returnedId.current = undefined;
  }, [connections.data, plugins.data, byKey, openDialog]);

  return (
    <Page
      title="Plugins"
      description="Give your agents tools from the services you use, or hook into their runs."
      documentTitle="Plugins"
    >
      <RegistryCatalog
        registry={plugins.data ?? []}
        connections={connections.data?.data ?? []}
        keyOf={pluginKeyOf}
        isLoading={plugins.isLoading || connections.isLoading}
        isError={plugins.isError || connections.isError}
        onRetry={() => {
          void plugins.refetch();
          void connections.refetch();
        }}
        noun="plugins"
        renderItem={(view) => {
          const plugin = byKey.get(view.key);
          return plugin ? (
            <PluginCatalogCard plugin={plugin} view={view} />
          ) : (
            <UninstalledCatalogCard view={view} noun="plugin" onDelete={deleteConnection} />
          );
        }}
      />
    </Page>
  );
};
