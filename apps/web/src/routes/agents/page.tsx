import { CatalogPageContent } from "@/components/catalog";
import { Page } from "@/components/page";
import { AgentCatalog } from "@/features/agent/components/agent-catalog";
import { ROUTES } from "@/routes";
import { useNavigate } from "react-router";

export const AgentsPage = () => {
  const navigate = useNavigate();

  return (
    <Page
      title="Agents"
      description="Build agents from models and plugins, then chat with them."
      documentTitle="Agents"
    >
      <CatalogPageContent createLabel="New agent" onCreate={() => navigate(ROUTES.agentNew)}>
        <AgentCatalog />
      </CatalogPageContent>
    </Page>
  );
};
