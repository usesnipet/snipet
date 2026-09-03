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
      description="Configured LLM providers for your workspace."
      documentTitle="LLM Providers"
    >
      <CatalogPageContent
        createLabel="New LLM Provider"
        onCreate={openCreate}
      >
        <LlmProviderCatalog />
      </CatalogPageContent>
    </Page>
  );
};
