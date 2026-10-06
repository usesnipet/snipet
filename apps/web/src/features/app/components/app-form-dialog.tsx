import { FormInput } from "@/components/form/input";
import { FormTextarea } from "@/components/form/textarea";
import { Button } from "@/components/ui/button";
import {
  DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Spinner } from "@/components/ui/spinner";
import { zodResolver } from "@hookform/resolvers/zod";
import { useId } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useCreateApp, useUpdateApp } from "@snipet/client";
import { createAppSchema } from "@snipet/shared";

import type { App, CreateApp } from "@snipet/shared";
import type { DialogInstanceProps } from "@/lib/dialog";

type AppFormDialogProps = DialogInstanceProps<{
  /** When set, the dialog edits this app instead of creating a new one. */
  app?: App;
}>;

// Origins are typed one per line, then validated with the shared schema.
const appFormSchema = createAppSchema.extend({
  allowedOrigins: z
    .string()
    .transform((value) => value.split("\n").map((line) => line.trim()).filter(Boolean))
    .pipe(createAppSchema.shape.allowedOrigins.unwrap()),
});
type AppFormInput = z.input<typeof appFormSchema>;

export function AppFormDialog({ app, close }: AppFormDialogProps) {
  const isEditing = !!app;
  const formId = `app-form-${useId()}`;

  const form = useForm<AppFormInput, unknown, CreateApp>({
    resolver: zodResolver(appFormSchema),
    defaultValues: { name: app?.name ?? "", allowedOrigins: app?.allowedOrigins.join("\n") ?? "" },
  });

  const { mutateAsync: create, isPending: isCreating } = useCreateApp();
  const { mutateAsync: update, isPending: isUpdating } = useUpdateApp(app?.id ?? "");
  const isPending = isCreating || isUpdating;

  const onSubmit = form.handleSubmit(async (values) => {
    if (isEditing) await update(values);
    else await create(values);
    close();
  });

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{isEditing ? "Edit app" : "Create app"}</DialogTitle>
        <DialogDescription>
          {isEditing
            ? <>Update settings for <span className="font-medium text-foreground">{app.name}</span>.</>
            : "An app groups the API keys and sessions of one client of your agents."}
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form id={formId} onSubmit={onSubmit} className="space-y-4">
          <FormInput name="name" label="Name" placeholder="My app" />
          <FormTextarea
            name="allowedOrigins"
            label="Allowed origins"
            placeholder={"https://app.example.com\nhttps://staging.example.com"}
            rows={4}
          />
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
          {isEditing ? "Save changes" : "Create app"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
