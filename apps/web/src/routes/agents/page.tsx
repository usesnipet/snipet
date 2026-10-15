import { CatalogPageContent } from "@/components/catalog";
import { Page } from "@/components/page";
import { AgentCatalog } from "@/features/agent/components/agent-catalog";
import { AgentFormDialog } from "@/features/agent/components/agent-form-dialog";
import { useDialog } from "@/lib/dialog";

export const AgentsPage = () => {
  const { openDialog } = useDialog();

  return (
    <Page
      title="Agents"
      description="Agents loop between LLMs and tools until the task is done."
      documentTitle="Agents"
    >
      <CatalogPageContent
        createLabel="New agent"
        onCreate={() => openDialog({ component: AgentFormDialog, props: {} })}
      >
        <AgentCatalog />
      </CatalogPageContent>
    </Page>
  );
};
