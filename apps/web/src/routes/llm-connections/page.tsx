import { CatalogPageContent, RegistryCatalog } from "@/components/catalog";
import { Page } from "@/components/page";
import { CreateLlmConnectionDialog } from "@/features/llm-connection/components/create-llm-connection-dialog";
import { LlmConnectionCatalogCard } from "@/features/llm-connection/components/llm-connection-catalog-card";
import { useDialog } from "@/lib/dialog";

import { useListLlmConnections, useLLMs } from "@snipet/client";

import type { LlmConnection } from "@snipet/shared";

const llmOf = (connection: LlmConnection) => connection.llmKey;

export const LlmConnectionsPage = () => {
  const { openDialog } = useDialog();
  const llms = useLLMs();
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
      description="Bring your own API keys or run models locally. Connect an LLM to make it available to your agents."
      documentTitle="LLM Connections"
    >
      <CatalogPageContent
        createLabel="Add connection"
        onCreate={openCreate}
      >
        <RegistryCatalog
          registry={llms.data ?? []}
          connections={connections.data?.data ?? []}
          keyOf={llmOf}
          isLoading={llms.isLoading || connections.isLoading}
          isError={llms.isError || connections.isError}
          noun="llms"
          renderItem={(view) => <LlmConnectionCatalogCard view={view} />}
        />
      </CatalogPageContent>
    </Page>
  );
};
