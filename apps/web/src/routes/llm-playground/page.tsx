import { Page } from "@/components/page";
import { Form } from "@/components/ui/form";
import { LlmConversationField } from "@/features/llm-connection/components/llm-conversation-field";
import { LlmModelsField } from "@/features/llm-connection/components/llm-models-field";
import { useForm } from "react-hook-form";

import type { ExecuteLlm } from "@/features/llm-connection/schemas";

const DEFAULT_VALUES: ExecuteLlm = {
  targets: [{ model: "" }],
  messages: [{ role: "user", parts: [{ type: "text", text: "" }] }],
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
        <form className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2">
            <LlmModelsField name="targets" />
          </div>
          <div className="lg:col-span-3">
            <LlmConversationField name="messages" targetsName="targets" />
          </div>
        </form>
      </Form>
    </Page>
  );
};
