import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { useLlmProviderRegistry } from "../hooks";

import type { LlmProvider } from "../schemas";
export type LLMProviderCatalogCardProps = {
  provider: LlmProvider;
};

export function LLMProviderCatalogCard({ provider }: LLMProviderCatalogCardProps) {
  const { data } = useLlmProviderRegistry();
  const registry = data?.find(r => r.key === provider.provider)

  return (
    <Card
      className={cn("flex h-full flex-col")}
    >
      <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-3">
        <img src={registry?.icon} alt="provider icon" />
        <div className="flex min-w-0 flex-1 items-center justify-between space-y-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-semibold leading-tight">{provider.name}</h2>
            <Badge variant="secondary" className="shrink-0 font-normal">
              {provider.provider}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3 pt-0">
        {provider.updated_at ? (
          <p className="mt-auto text-xs text-muted-foreground">
            Updated {provider.updated_at.toISOString()}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
