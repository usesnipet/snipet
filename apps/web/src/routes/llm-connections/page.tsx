import { CatalogPageContent, RegistryCatalog } from "@/components/catalog";
import { Page } from "@/components/page";
import { CreateLlmConnectionDialog } from "@/features/llm-connection/components/create-llm-connection-dialog";
import { LlmConnectionCatalogCard } from "@/features/llm-connection/components/llm-connection-catalog-card";
import { useDialog } from "@/lib/dialog";

import { useListLlmConnections, useLlmProviders } from "@snipet/client";

import type { LlmConnection } from "@snipet/shared";

const providerOf = (connection: LlmConnection) => connection.provider;

export const LlmConnectionsPage = () => {
  const { openDialog } = useDialog();
  const providers = useLlmProviders();
  const connections = useListLlmConnections();

  const openCreate = () => {
    openDialog({
      component: CreateLlmConnectionDialog,
      props: {},
    });
  };

  return (
    <Page
      title="LLM Connections"
      description="Bring your own API keys or run models locally. Connect a provider to make it available to your agents."
      documentTitle="LLM Connections"
    >
      <CatalogPageContent
        createLabel="Add connection"
        onCreate={openCreate}
      >
        <RegistryCatalog
          registry={providers.data ?? []}
          connections={connections.data?.data ?? []}
          keyOf={providerOf}
          isLoading={providers.isLoading || connections.isLoading}
          isError={providers.isError || connections.isError}
          noun="providers"
          renderItem={(view) => <LlmConnectionCatalogCard view={view} />}
        />
      </CatalogPageContent>
    </Page>
  );
};
