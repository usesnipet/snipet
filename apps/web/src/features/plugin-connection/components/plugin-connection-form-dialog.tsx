import { FormInput } from "@/components/form/input";
import { FormSwitch } from "@/components/form/switch";
import { FormTextarea } from "@/components/form/textarea";
import { SchemaFormFields } from "@/components/schema-form";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { Form } from "@/components/ui/form";
import { Spinner } from "@/components/ui/spinner";
import { useDialog } from "@/lib/dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronRight } from "lucide-react";
import { useId } from "react";
import { useForm, useWatch } from "react-hook-form";

import { useCreatePluginConnection, useUpdatePluginConnection } from "@snipet/client";
import { createPluginConnectionSchema, hookHandlersOf } from "@snipet/shared";

import { describeHandler } from "../capabilities";
import { PluginConnectionListDialog } from "./dialogs";

import type { RJSFSchema } from "@rjsf/utils";
import type { CreatePluginConnection, HooksCapability, PluginConnection, PluginManifest } from "@snipet/shared";

import type { DialogInstanceProps } from "@/lib/dialog";

type PluginConnectionFormDialogProps = DialogInstanceProps<{
  plugin: PluginManifest;
  connection?: PluginConnection;
  /** Opens the plugin's connection list after creating, where the sync result shows up. Off when the list is already open below. */
  openListOnCreate?: boolean;
}>;

/**
 * Creates or edits a plugin connection. Secret config fields come back masked;
 * sending the mask unchanged keeps the stored value (the API restores it).
 */
export function PluginConnectionFormDialog({
  plugin,
  connection,
  openListOnCreate,
  close,
}: PluginConnectionFormDialogProps) {
  const isEditing = !!connection;
  const formId = `plugin-connection-${useId()}`;
  const { openDialog } = useDialog();
  const form = useForm<CreatePluginConnection>({
    resolver: zodResolver(createPluginConnectionSchema),
    defaultValues: {
      name: connection?.name ?? plugin.name,
      pluginKey: plugin.key,
      config: connection?.config ?? {},
      enabled: connection?.enabled ?? true,
      customInstructions: connection?.customInstructions ?? "",
    },
  });

  const { mutateAsync: create, isPending: isCreating } = useCreatePluginConnection();
  const { mutateAsync: update, isPending: isUpdating } = useUpdatePluginConnection();
  const isPending = isCreating || isUpdating;

  const schema = plugin.connection as RJSFSchema;
  const hasConfig = Object.keys(schema.properties ?? {}).length > 0;
  // Hooks-only plugins put nothing in the prompt, so there's nothing to instruct.
  const takesInstructions = !!(plugin.capabilities.instructions || plugin.capabilities.tools);
  const pluginInstructions = connection?.instructions;
  const customInstructions = useWatch({ control: form.control, name: "customInstructions" });

  const onSubmit = form.handleSubmit(async (values) => {
    // An emptied textarea goes back to the plugin's own instructions.
    values = { ...values, customInstructions: values.customInstructions?.trim() || null };
    if (connection) await update({ id: connection.id, data: values });
    else await create({ data: values });
    close();
    if (!connection && openListOnCreate) openDialog({ component: PluginConnectionListDialog, props: { plugin } });
  });

  return (
    <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{isEditing ? `Edit ${connection.name}` : `Connect ${plugin.name}`}</DialogTitle>
        <DialogDescription>
          {isEditing ? `${plugin.name} connection.` : plugin.description || `Create a connection to ${plugin.name}.`}
        </DialogDescription>
      </DialogHeader>
      <DialogBody>
        <Form {...form}>
          <form id={formId} onSubmit={onSubmit}>
            <FieldGroup>
              <FormInput name="name" label="Name" required />
              {takesInstructions && (
                <div className="flex flex-col gap-2">
                  {pluginInstructions && !customInstructions && (
                    <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-medium text-muted-foreground">Plugin instructions</p>
                        <Button
                          type="button"
                          variant="link"
                          size="xs"
                          className="h-auto p-0"
                          onClick={() => form.setValue("customInstructions", pluginInstructions, { shouldDirty: true })}
                        >
                          Customize
                        </Button>
                      </div>
                      <p className="max-h-32 overflow-y-auto whitespace-pre-wrap text-xs">{pluginInstructions}</p>
                    </div>
                  )}
                  <FormTextarea
                    name="customInstructions"
                    label="Instructions"
                    rows={4}
                    placeholder={
                      pluginInstructions
                        ? "Leave empty to use the plugin instructions above."
                        : "How agents should use this plugin. Replaces the plugin's own instructions."
                    }
                  />
                </div>
              )}
              <div className="flex flex-col gap-1">
                <FormSwitch name="enabled" label="Enabled" />
                <p className="text-muted-foreground text-xs">Agents can't use this connection while it's off.</p>
              </div>
              {plugin.capabilities.hooks && <HooksSummary hooks={plugin.capabilities.hooks} />}
              {hasConfig && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-medium text-muted-foreground">Configuration</p>
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <SchemaFormFields
                      schema={schema}
                      defaultData={form.getValues("config")}
                      onChange={(data) => form.setValue("config", data, { shouldDirty: true })}
                    />
                  </div>
                </div>
              )}
            </FieldGroup>
          </form>
        </Form>
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" disabled={isPending}>
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" form={formId} disabled={isPending}>
          {isPending && <Spinner size="sm" />}
          {isEditing ? "Save changes" : "Create connection"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

/** One sentence on what the plugin's hooks do, with each hook in an expandable detail. */
function HooksSummary({ hooks }: { hooks: HooksCapability }) {
  const handlers = [...hookHandlersOf(hooks)];
  const onlyWatches = handlers.every(([, handler]) => !handler.actions.length);
  const count = `${handlers.length} ${handlers.length === 1 ? "moment" : "moments"}`;

  return (
    <Collapsible className="flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">Hooks</p>
        <p className="text-muted-foreground text-xs">
          {onlyWatches
            ? `Watches ${count} of each run. It doesn't change what agents see.`
            : `Acts on ${count} of each run.`}
        </p>
      </div>
      <CollapsibleTrigger className="text-muted-foreground group flex w-fit items-center gap-0.5 text-xs hover:text-foreground">
        <ChevronRight className="size-3 transition-transform group-data-[state=open]:rotate-90" />
        Show hooks
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="space-y-0.5 text-xs">
          {handlers.map(([hook, handler]) => (
            <li key={hook}>
              <code>{hook}</code> <span className="text-muted-foreground">{describeHandler(handler)}</span>
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
