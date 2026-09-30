import { Page } from "@/components/page";
import { ToolPlayground } from "@/features/tool/components/tool-playground";

export const ToolPlaygroundPage = () => (
  <Page
    title="Tool Playground"
    description="Run any tool by hand: pick one, fill in its arguments and see exactly what it returns."
    documentTitle="Tool Playground · Snipet"
  >
    <ToolPlayground />
  </Page>
);
