import { FormInput } from "@/components/form/input";
import { FormSwitch } from "@/components/form/switch";
import { FormTextarea } from "@/components/form/textarea";
import { Button } from "@/components/ui/button";
import {
  DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { Form } from "@/components/ui/form";
import { Spinner } from "@/components/ui/spinner";
import { LlmModelsField } from "@/features/llm-connection/components/llm-models-field";
import { zodResolver } from "@hookform/resolvers/zod";
import { useId } from "react";
import { useForm } from "react-hook-form";

import { useCreateAgent, useUpdateAgent } from "../hooks";
import { createAgentSchema } from "../schemas";

import { AgentMcpServersField } from "./agent-mcp-servers-field";

import type { Agent, CreateAgent, CreateAgentInput } from "../schemas";
import type { DialogInstanceProps } from "@/lib/dialog";

type AgentFormDialogProps = DialogInstanceProps<{
  /** When set, the dialog edits this agent instead of creating one. */
  agent?: Agent;
}>;

const toForm = (agent?: Agent): CreateAgentInput => ({
  name: agent?.name ?? "",
  description: agent?.description ?? "",
  system_prompt: agent?.system_prompt ?? "",
  max_turns: agent?.max_turns ?? 20,
  enabled: agent?.enabled ?? true,
  llms: agent?.llms?.sort((a, b) => a.order - b.order)
    .map((llm) => ({
      model: llm.model,
      llm_connection_id: llm.llm_connection_id ?? undefined,
      extra_options: llm.extra_options ?? undefined,
    })) ?? [{ model: "" }],
  mcp_servers: (agent?.mcp_servers ?? []).map(({ mcp_server_id, allow, deny }) => ({ mcp_server_id, allow, deny })),
});

export function AgentFormDialog({ agent, close }: AgentFormDialogProps) {
  const formId = `agent-form-${useId()}`;
  const form = useForm<CreateAgentInput, unknown, CreateAgent>({
    resolver: zodResolver(createAgentSchema),
    defaultValues: toForm(agent),
  });

  const { mutateAsync: create, isPending: isCreating } = useCreateAgent();
  const { mutateAsync: update, isPending: isUpdating } = useUpdateAgent(agent?.id ?? "");
  const isPending = isCreating || isUpdating;

  const onSubmit = form.handleSubmit(async (values) => {
    if (agent) await update(values);
    else await create(values);
    close();
  });

  return (
    <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{agent ? "Edit agent" : "New agent"}</DialogTitle>
        <DialogDescription>
          An agent loops between its models and tools until the task is done or it runs out of turns.
        </DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form id={formId} onSubmit={onSubmit}>
          <FieldGroup>
            <FormInput name="name" label="Name" placeholder="e.g. Support triage" required />
            <FormInput name="description" label="Description" placeholder="What this agent is for" />
            <FormTextarea name="system_prompt" label="System prompt" rows={5} placeholder="You are…" />
            <div className="flex items-end gap-4">
              <FormInput name="max_turns" label="Max turns" inputMode="numeric" fieldclassname="max-w-32" />
              <FormSwitch name="enabled" label="Enabled" fieldclassname="pb-2" />
            </div>
            <LlmModelsField name="llms" allowedModelCapabilities={["text", "streaming"]} />
            <AgentMcpServersField />
          </FieldGroup>
        </form>
      </Form>

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" disabled={isPending}>
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" form={formId} disabled={isPending}>
          {isPending && <Spinner size="sm" />}
          {agent ? "Save changes" : "Create agent"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
