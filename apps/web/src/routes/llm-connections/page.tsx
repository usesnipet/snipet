import { RegistryCatalog, UninstalledCatalogCard } from "@/components/catalog";
import { Icon } from "@/components/icon";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { CreateLlmConnectionDialog } from "@/features/llm-connection/components/dialogs";
import { LlmConnectionCatalogCard } from "@/features/llm-connection/components/llm-connection-catalog-card";
import { useDialog } from "@/lib/dialog";
import { useDeleteLlmConnection, useListLlmConnections, useLLMs } from "@snipet/client";

import type { LlmConnection, LlmManifest } from "@snipet/shared";

const llmOf = (connection: LlmConnection) => connection.llmKey;

/** Providers suggested first when nothing is connected yet: hosted, aggregator and local. */
const COMMON_LLM_KEYS = ["openai", "gemini", "openrouter", "ollama"];

export const LlmConnectionsPage = () => {
  const llms = useLLMs();
  const connections = useListLlmConnections();
  const { mutateAsync: deleteConnection } = useDeleteLlmConnection();
  const hasNoConnections = connections.isSuccess && connections.data.data.length === 0;

  return (
    <Page
      title="LLMs"
      description="Bring your own API keys or run models locally. Each provider can have several connections, and your agents use them to generate text."
      documentTitle="LLMs"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-5">
        {hasNoConnections && llms.data && <GetStarted llms={llms.data} />}
        <RegistryCatalog
          registry={llms.data ?? []}
          connections={connections.data?.data ?? []}
          keyOf={llmOf}
          isLoading={llms.isLoading || connections.isLoading}
          isError={llms.isError || connections.isError}
          onRetry={() => {
            void llms.refetch();
            void connections.refetch();
          }}
          noun="LLMs"
          renderItem={(view) =>
            view.installed ? (
              <LlmConnectionCatalogCard view={view} />
            ) : (
              <UninstalledCatalogCard view={view} noun="LLM" onDelete={deleteConnection} />
            )
          }
        />
      </div>
    </Page>
  );
};

/** Shown until the first connection exists: agents can't run without one. */
function GetStarted({ llms }: { llms: LlmManifest[] }) {
  const { openDialog } = useDialog();
  const common = COMMON_LLM_KEYS.flatMap((key) => llms.find((llm) => llm.key === key) ?? []);

  return (
    <div className="flex shrink-0 flex-col gap-3 rounded-lg border border-primary/40 bg-primary/5 p-4">
      <div>
        <p className="font-medium">Connect your first LLM</p>
        <p className="text-muted-foreground text-sm">
          Agents need at least one connection to run. Most people start with:
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {common.map((llm) => (
          <Button
            key={llm.key}
            variant="outline"
            onClick={() =>
              openDialog({ component: CreateLlmConnectionDialog, props: { defaultValues: { llmKey: llm.key } } })
            }
          >
            <Icon name={llm.name} icon={llm.icon} className="size-5" />
            {llm.name}
          </Button>
        ))}
      </div>
    </div>
  );
}
