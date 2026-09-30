import { Page } from "@/components/page";
import { ToolBrowser } from "@/features/tool/components/tool-browser";

export const ToolsPage = () => (
  <Page
    title="Tools"
    description="Every tool your agents can call — from connected MCP servers and built into Snipet. Open one to see its parameters and input schema."
    documentTitle="Tools"
  >
    <ToolBrowser />
  </Page>
);
