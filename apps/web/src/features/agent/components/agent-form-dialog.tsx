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

import { useCreateAgent, useUpdateAgent } from "@snipet/client";
import { agentFormSchema } from "../schemas";

import { AgentMcpServersField } from "./agent-mcp-servers-field";

import type { AgentForm, AgentFormInput } from "../schemas";
import type { Agent } from "@snipet/shared";
import type { DialogInstanceProps } from "@/lib/dialog";

type AgentFormDialogProps = DialogInstanceProps<{
  /** When set, the dialog edits this agent instead of creating one. */
  agent?: Agent;
}>;

// The API returns llms already ordered.
const toForm = (agent?: Agent): AgentFormInput => ({
  name: agent?.name ?? "",
  description: agent?.description ?? "",
  systemPrompt: agent?.systemPrompt ?? "",
  maxTurns: agent?.maxTurns ?? 20,
  enabled: agent?.enabled ?? true,
  llms: agent?.llms.map((llm) => ({
    model: llm.model,
    connectionId: llm.connectionId ?? undefined,
    extraOptions: llm.extraOptions ?? undefined,
  })) ?? [{ model: "" }],
  mcpServers: (agent?.mcpServers ?? []).map(({ mcpServerId, allow, deny }) => ({ mcpServerId, allow, deny })),
});

export function AgentFormDialog({ agent, close }: AgentFormDialogProps) {
  const formId = `agent-form-${useId()}`;
  const form = useForm<AgentFormInput, unknown, AgentForm>({
    resolver: zodResolver(agentFormSchema),
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
            <FormTextarea name="systemPrompt" label="System prompt" rows={5} placeholder="You are…" />
            <div className="flex items-end gap-4">
              <FormInput name="maxTurns" label="Max turns" inputMode="numeric" fieldclassname="max-w-32" />
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
