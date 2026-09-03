import { CatalogCard, CatalogList } from "@/components/catalog";
import { LoadingFallback } from "@/components/loading-fallback";

import { useListLlmProviders } from "../hooks";

import type { LlmProvider } from "../schemas";

export function LlmProviderCatalog() {
  const { data, isLoading, isError } = useListLlmProviders();

  if (isLoading) {
    return <LoadingFallback />;
  }

  if (isError) {
    return (
      <p className="text-sm text-destructive">Failed to load LLM providers.</p>
    );
  }

  const providers = data?.data ?? [];

  return (
    <CatalogList<LlmProvider>
      items={providers}
      emptyMessage="No LLM providers yet."
      renderItem={(provider) => (
        <CatalogCard
          title={provider.name}
          badge={provider.provider}
          updatedAt={provider.updated_at.toISOString()}
        />
      )}
    />
  );
}
