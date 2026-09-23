import { CatalogPageContent } from "@/components/catalog";
import { Page } from "@/components/page";
import { McpServerCatalog } from "@/features/mcp-server/components/mcp-server-catalog";
import { McpServerFormDialog } from "@/features/mcp-server/components/mcp-server-form-dialog";
import { useDialog } from "@/lib/dialog";

export const McpServersPage = () => {
  const { openDialog } = useDialog();

  return (
    <Page
      title="MCP Servers"
      description="Give your agents new tools. Install a server from the registry in a couple of clicks, or connect any MCP server you run."
      documentTitle="MCP Servers"
    >
      <CatalogPageContent
        createLabel="Add custom server"
        onCreate={() => openDialog({ component: McpServerFormDialog, props: {} })}
      >
        <McpServerCatalog />
      </CatalogPageContent>
    </Page>
  );
};
