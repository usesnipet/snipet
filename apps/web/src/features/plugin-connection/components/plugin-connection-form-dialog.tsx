import { FormInput } from "@/components/form/input";
import { FormSwitch } from "@/components/form/switch";
import { FormTextarea } from "@/components/form/textarea";
import { SchemaFormFields } from "@/components/schema-form";
import { Button } from "@/components/ui/button";
import {
  DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { Form } from "@/components/ui/form";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useId } from "react";
import { useForm } from "react-hook-form";

import { useCreatePluginConnection, useUpdatePluginConnection } from "@snipet/client";
import { createPluginConnectionSchema } from "@snipet/shared";

import type { RJSFSchema } from "@rjsf/utils";
import type { CreatePluginConnection, PluginConnection, PluginManifest } from "@snipet/shared";

import type { DialogInstanceProps } from "@/lib/dialog";

type PluginConnectionFormDialogProps = DialogInstanceProps<{
  plugin: PluginManifest;
  connection?: PluginConnection;
}>;

/**
 * Creates or edits a plugin connection. Secret config fields come back masked;
 * sending the mask unchanged keeps the stored value (the API restores it).
 */
export function PluginConnectionFormDialog({ plugin, connection, close }: PluginConnectionFormDialogProps) {
  const isEditing = !!connection;
  const formId = `plugin-connection-${useId()}`;
  const form = useForm<CreatePluginConnection>({
    resolver: zodResolver(createPluginConnectionSchema),
    defaultValues: {
      name: connection?.name ?? plugin.name,
      description: connection?.description ?? "",
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

  const onSubmit = form.handleSubmit(async (values) => {
    // An emptied textarea goes back to the plugin's own instructions.
    values = { ...values, customInstructions: values.customInstructions?.trim() || null };
    if (connection) await update({ id: connection.id, data: values });
    else await create({ data: values });
    close();
  });

  return (
    <DialogContent className={cn("max-h-[90vh] overflow-y-auto", hasConfig ? "sm:max-w-4xl" : "sm:max-w-lg")}>
      <DialogHeader>
        <DialogTitle>{isEditing ? "Edit connection" : `Connect ${plugin.name}`}</DialogTitle>
        <DialogDescription>
          {isEditing
            ? <>Update settings for <span className="font-medium text-foreground">{connection.name}</span>.</>
            : plugin.description || `Create a connection to ${plugin.name}.`}
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form id={formId} onSubmit={onSubmit} className={cn(hasConfig && "grid gap-6 md:grid-cols-2")}>
          <FieldGroup>
            <FormInput name="name" label="Name" required />
            <FormTextarea name="description" label="Description" />
            <FormTextarea
              name="customInstructions"
              label="Instructions"
              rows={4}
              placeholder={
                connection?.instructions ?? "How agents should use this plugin. Replaces the plugin's own instructions."
              }
            />
            <FormSwitch name="enabled" label="Enabled" />
          </FieldGroup>
          {hasConfig ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Configuration</p>
              <div className="rounded-lg border bg-muted/30 p-3">
                <SchemaFormFields
                  schema={schema}
                  defaultData={form.getValues("config")}
                  onChange={(data) => form.setValue("config", data, { shouldDirty: true })}
                />
              </div>
            </div>
          ) : null}
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
          {isEditing ? "Save changes" : "Create connection"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
