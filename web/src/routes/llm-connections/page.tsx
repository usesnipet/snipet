import { CatalogPageContent } from "@/components/catalog";
import { Page } from "@/components/page";
import { CreateLlmConnectionDialog } from "@/features/llm-connection/components/create-llm-connection-dialog";
import { LlmConnectionCatalog } from "@/features/llm-connection/components/llm-connection-catalog";
import { useDialog } from "@/lib/dialog";

export const LlmConnectionsPage = () => {
  const { openDialog } = useDialog();

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
        <LlmConnectionCatalog />
      </CatalogPageContent>
    </Page>
  );
};
