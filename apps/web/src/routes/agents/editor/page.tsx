import { Page } from "@/components/page";
import { Link } from "@/components/ui/link";
import { Skeleton } from "@/components/ui/skeleton";
import { AgentEditor } from "@/features/agent/components/agent-editor";
import { ROUTES } from "@/routes";
import { useAgent } from "@snipet/client";
import { useParams } from "react-router";

/** Creates an agent at the "new" route, edits one at the route with an agentId. */
export const AgentEditorPage = () => {
  const { agentId } = useParams();
  const agentQuery = useAgent(agentId);
  const title = agentId ? (agentQuery.data?.name ?? "Edit agent") : "New agent";

  let content = <AgentEditorSkeleton />;
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

/** A labelled input placeholder: label line, then the field. */
function FieldSkeleton({ fieldClassName = "h-10" }: { fieldClassName?: string }) {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className={fieldClassName} />
    </div>
  );
}

/**
 * The agent form's shape while the agent loads: avatar, name, description and
 * system prompt on the left, models and plugins on the right, on the same grid
 * as `AgentEditor`.
 */
function AgentEditorSkeleton() {
  return (
    <div role="status" className="-mr-3 -ml-1 min-h-0 flex-1 overflow-hidden">
      <span className="sr-only">Loading agent</span>
      <div aria-hidden className="grid grid-cols-1 gap-x-10 gap-y-8 p-1 pr-3 xl:grid-cols-2">
        <div className="space-y-6">
          <div className="flex items-start gap-4">
            <Skeleton className="size-24 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-6">
              <FieldSkeleton />
              <FieldSkeleton />
            </div>
          </div>
          {/* The system prompt textarea is 14 rows tall. */}
          <FieldSkeleton fieldClassName="h-80" />
          <FieldSkeleton fieldClassName="h-10 w-32" />
        </div>
        <div className="space-y-6">
          <div className="space-y-3">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-3.5 w-72 max-w-full" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
          <Skeleton className="h-px" />
          <div className="space-y-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        </div>
      </div>
    </div>
  );
}
