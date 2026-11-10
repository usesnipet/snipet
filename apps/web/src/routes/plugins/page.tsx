import { RegistryCatalog, UninstalledCatalogCard } from "@/components/catalog";
import { Page } from "@/components/page";
import { PluginCatalogCard } from "@/features/plugin-connection/components/plugin-catalog-card";
import { useMemo } from "react";

import { useDeletePluginConnection, useListPluginConnections, usePlugins } from "@snipet/client";

import type { PluginConnection } from "@snipet/shared";

const pluginKeyOf = (connection: PluginConnection) => connection.pluginKey;

export const PluginsPage = () => {
  const plugins = usePlugins();
  const connections = useListPluginConnections();
  const { mutateAsync: deleteConnection } = useDeletePluginConnection();
  const byKey = useMemo(() => new Map(plugins.data?.map((p) => [p.key, p])), [plugins.data]);

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
