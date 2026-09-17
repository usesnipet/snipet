import { Page } from "@/components/page";
import { Form } from "@/components/ui/form";
import { LlmModelsField } from "@/features/llm-connection/components/llm-models-field";
import { useForm } from "react-hook-form";

import type { ExecuteLlm } from "@/features/llm-connection/schemas";

const DEFAULT_VALUES: ExecuteLlm = {
  targets: [{ model: "" }],
  messages: [],
};

export const LlmPlaygroundPage = () => {
  const form = useForm<ExecuteLlm>({ defaultValues: DEFAULT_VALUES });

  return (
    <Page
      title="Playground"
      description="Try your LLM connections directly: pick a model and send a message."
      documentTitle="Playground · Snipet"
    >
      <Form {...form}>
        <form className="space-y-6">
          <LlmModelsField name="targets" />
        </form>
      </Form>
    </Page>
  );
};
