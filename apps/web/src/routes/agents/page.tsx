import { Page, PageActions } from "@/components/page";
import { Button } from "@/components/ui/button";
import { AgentFormDialog } from "@/features/agent/components/agent-form-dialog";
import { AgentsTable } from "@/features/agent/components/agents-table";
import { useDialog } from "@/lib/dialog";
import { Plus } from "lucide-react";

export const AgentsPage = () => {
  const { openDialog } = useDialog();

  return (
    <Page
      title="Agents"
      description="Agents loop between LLMs and tools until the task is done."
      documentTitle="Agents"
    >
      <PageActions>
        <Button onClick={() => openDialog({ component: AgentFormDialog, props: {} })}>
          <Plus className="size-4" /> New agent
        </Button>
      </PageActions>
      <AgentsTable />
    </Page>
  );
};
