import { LoadingFallback } from "@/components/loading-fallback";
import { Page } from "@/components/page";
import { Link } from "@/components/ui/link";
import { AgentEditor } from "@/features/agent/components/agent-editor";
import { ROUTES } from "@/routes";
import { useAgent } from "@snipet/client";
import { useParams } from "react-router";

/** Creates an agent at the "new" route, edits one at the route with an agentId. */
export const AgentEditorPage = () => {
  const { agentId } = useParams();
  const agentQuery = useAgent(agentId);
  const title = agentId ? (agentQuery.data?.name ?? "Edit agent") : "New agent";

  let content = <LoadingFallback />;
  if (!agentId || agentQuery.data) {
    content = <AgentEditor key={agentId ?? "new"} agent={agentQuery.data} />;
  } else if (agentQuery.isError) {
    content = (
      <p className="text-destructive text-sm">
        Failed to load this agent.{" "}
        <Link href={ROUTES.agents} className="underline">
          Back to agents
        </Link>
      </p>
    );
  }

  return (
    <Page
      title={title}
      description="Define what this agent does, which models it uses and what it can access."
      documentTitle={title}
    >
      {content}
    </Page>
  );
};
