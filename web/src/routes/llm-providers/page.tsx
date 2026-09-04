import { CatalogPageContent } from "@/components/catalog";
import { Page } from "@/components/page";
import { CreateLlmProviderDialog } from "@/features/llm-provider/components/create-llm-provider-dialog";
import { LlmProviderCatalog } from "@/features/llm-provider/components/llm-provider-catalog";
import { useDialog } from "@/lib/dialog";

export const LlmProvidersPage = () => {
  const { openDialog } = useDialog();

  const openCreate = () => {
    openDialog({
      component: CreateLlmProviderDialog,
      props: {},
    });
  };

  return (
    <Page
      title="LLM Providers"
      description="Bring your own API keys or run models locally. Connect a provider to make it available to your agents."
      documentTitle="LLM Providers"
    >
      <CatalogPageContent
        createLabel="Add provider"
        onCreate={openCreate}
      >
        <LlmProviderCatalog />
      </CatalogPageContent>
    </Page>
  );
};
