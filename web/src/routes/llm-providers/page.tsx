import { CatalogPageContent } from "@/components/catalog";
import { Page } from "@/components/page";
import { LlmProviderCatalog } from "@/features/llm-provider/components/llm-provider-catalog";

export const LlmProvidersPage = () => {
  return (
    <Page
      title="LLM Providers"
      description="Configured LLM providers for your workspace."
      documentTitle="LLM Providers"
    >
      <CatalogPageContent
        createLabel="New LLM Provider"
        onCreate={() => {}}
      >
        <LlmProviderCatalog />
      </CatalogPageContent>
    </Page>
  );
};
