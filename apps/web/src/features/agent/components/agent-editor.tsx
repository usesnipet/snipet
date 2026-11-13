import { FormInput } from "@/components/form/input";
import { FormSlider } from "@/components/form/slider";
import { FormSwitch } from "@/components/form/switch";
import { FormTextarea } from "@/components/form/textarea";
import { UnsavedChangesGuard } from "@/components/form/unsaved-changes-guard";
import { PageActions } from "@/components/page";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Form } from "@/components/ui/form";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { LlmModelsField } from "@/features/llm-connection/components/llm-models-field";
import { toast } from "@/hooks/use-toast";
import { ROUTES } from "@/routes";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateAgent, useUpdateAgent } from "@snipet/client";
import { LLMCapability } from "@snipet/shared/core";
import { useEffect, useId } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";

import { agentFormSchema } from "../schemas";

import { AgentAvatarField } from "./agent-avatar";
import { AgentPluginsField } from "./agent-plugins-field";

import type { AgentForm, AgentFormInput } from "../schemas";
import type { Agent } from "@snipet/shared";

/** Maps an agent to form values (empty when creating); the API already returns llms in order. */
const toForm = (agent?: Agent): AgentFormInput => ({
  name: agent?.name ?? "",
  description: agent?.description ?? "",
  avatar: agent?.avatar ?? null,
  systemPrompt: agent?.systemPrompt ?? "",
  maxTurns: agent?.maxTurns ?? 20,
  historyRuns: agent?.historyRuns ?? 10,
  enabled: agent?.enabled ?? true,
  llms: agent?.llms.map(({ connectionId, model }) => ({ connectionId, model })) ?? [{ connectionId: "", model: "" }],
  pluginConnections: (agent?.pluginConnections ?? []).map(({ pluginConnectionId, tools, settings, disabledHooks }) => ({
    pluginConnectionId,
    tools,
    settings,
    disabledHooks,
  })),
});

/**
 * Creates an agent, or edits `agent` when given. Must render inside a Page: its
 * actions go in the page header, so Save stays visible while the form scrolls.
 */
export function AgentEditor({ agent }: { agent?: Agent }) {
  const navigate = useNavigate();
  const formId = `agent-form-${useId()}`;
  const form = useForm<AgentFormInput, unknown, AgentForm>({
    resolver: zodResolver(agentFormSchema),
    defaultValues: toForm(agent),
  });

  const { mutateAsync: create, isPending: isCreating } = useCreateAgent();
  const { mutateAsync: update, isPending: isUpdating } = useUpdateAgent(agent?.id ?? "");
  const isPending = isCreating || isUpdating;

  const { isDirty, isSubmitSuccessful } = form.formState;

  // In an effect, not in onSubmit, so the guard has already released by the time this navigates.
  useEffect(() => {
    if (isSubmitSuccessful) navigate(ROUTES.agents);
  }, [isSubmitSuccessful, navigate]);

  const onSubmit = form.handleSubmit(
    async (values) => {
      if (agent) await update(values);
      else await create(values);
    },
    // The invalid field can be off screen, and Save would then look like it did nothing.
    () => toast({ title: "Check the highlighted fields", variant: "destructive" }),
  );

  return (
    <>
      <UnsavedChangesGuard when={isDirty && !isSubmitSuccessful} />
      <PageActions>
        <Button type="button" variant="outline" disabled={isPending} onClick={() => navigate(ROUTES.agents)}>
          Cancel
        </Button>
        <Button type="submit" form={formId} disabled={isPending}>
          {isPending && <Spinner size="sm" />}
          {agent ? "Save changes" : "Create agent"}
        </Button>
      </PageActions>

      {/* Radix wraps the content in a display:table that grows with it, which would stop long tool lines truncating. */}
      <ScrollArea className="-ml-1 -mr-3 min-h-0 flex-1 [&>[data-radix-scroll-area-viewport]>div]:block!">
        <Form {...form}>
          {/* The right padding and negative margin keep the scrollbar off the fields, in the page's gutter. */}
          <form id={formId} onSubmit={onSubmit} className="grid grid-cols-1 gap-x-10 gap-y-8 p-1 pr-3 xl:grid-cols-2">
            <FieldGroup>
              <div className="flex items-start gap-4">
                <AgentAvatarField name="avatar" />
                <FieldGroup className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                    <FormInput
                      name="name"
                      label="Name"
                      placeholder="e.g. Support triage"
                      required
                      fieldclassname="min-w-48 flex-1"
                    />
                    {/* The top margin lines the switch up with the input, past the label above it. */}
                    <FormSwitch name="enabled" label="Enabled" fieldclassname="h-10 shrink-0 space-y-0 sm:mt-6" />
                  </div>
                  <FormInput name="description" label="Description" placeholder="What this agent is for" />
                </FieldGroup>
              </div>
              <FormTextarea name="systemPrompt" label="System prompt" rows={14} placeholder="You are…" />
              <FormInput
                name="maxTurns"
                label="Max turns"
                inputMode="numeric"
                className="max-w-32"
                description="How many times the agent can call a model to answer one message. At the limit it stops, even if unfinished."
              />
              <FormSlider
                name="historyRuns"
                label="Chat history"
                min={0}
                max={100}
                showValue
                description="How many earlier messages of the chat, with their replies, the models can see. More keeps context but costs more tokens."
              />
            </FieldGroup>
            <div className="space-y-6">
              <LlmModelsField name="llms" allowedModelCapabilities={[LLMCapability.TEXT]} />
              <Separator />
              <AgentPluginsField />
            </div>
          </form>
        </Form>
      </ScrollArea>
    </>
  );
}
