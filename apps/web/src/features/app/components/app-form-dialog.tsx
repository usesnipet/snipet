import { FormInput } from "@/components/form/input";
import { FormStringList } from "@/components/form/string-list";
import { FormSwitch } from "@/components/form/switch";
import { Button } from "@/components/ui/button";
import {
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Spinner } from "@/components/ui/spinner";
import { zodResolver } from "@hookform/resolvers/zod";
import { useDialog } from "@/lib/dialog";
import { useCreateApp, useUpdateApp } from "@snipet/client";
import { createAppSchema } from "@snipet/shared";
import { useId } from "react";
import { useForm, useWatch } from "react-hook-form";

import { AppDialog } from "./dialogs";

import type { App, CreateApp } from "@snipet/shared";
import type { DialogInstanceProps } from "@/lib/dialog";

type AppFormDialogProps = DialogInstanceProps<{
  /** When set, the dialog edits this app instead of creating a new one. */
  app?: App;
}>;

export function AppFormDialog({ app, close }: AppFormDialogProps) {
  const { openDialog } = useDialog();
  const isEditing = !!app;
  const formId = `app-form-${useId()}`;

  const form = useForm<CreateApp>({
    resolver: zodResolver(createAppSchema),
    // Origins are easy to get wrong (a trailing slash fails), so check each one when it loses focus.
    mode: "onTouched",
    defaultValues: {
      name: app?.name ?? "",
      allowedOrigins: app?.allowedOrigins ?? [],
      allowAnonymous: app?.allowAnonymous ?? false,
    },
  });

  const [allowAnonymous, allowedOrigins] = useWatch({
    control: form.control,
    name: ["allowAnonymous", "allowedOrigins"],
  });
  const anonymousWithoutOrigins = allowAnonymous && !allowedOrigins?.some((origin) => origin.trim());

  const { mutateAsync: create, isPending: isCreating } = useCreateApp();
  const { mutateAsync: update, isPending: isUpdating } = useUpdateApp(app?.id ?? "");
  const isPending = isCreating || isUpdating;

  const onSubmit = form.handleSubmit(async (values) => {
    if (isEditing) {
      await update(values);
      close();
      return;
    }
    const created = await create(values);
    close();
    // A new app has no API keys yet: land on its details, which lead to creating one.
    openDialog({ component: AppDialog, props: { app: created, isNew: true } });
  });

  return (
    <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{isEditing ? "Edit app" : "Create app"}</DialogTitle>
        <DialogDescription>
          {isEditing
            ? "Change where the app runs and who can chat."
            : "A site or product where people chat with your agents. It holds the API keys and decides who can chat."}
        </DialogDescription>
      </DialogHeader>
      <DialogBody>
        <Form {...form}>
          <form id={formId} onSubmit={onSubmit} className="space-y-4">
            <FormInput name="name" label="Name" placeholder="My app" />
            <FormStringList
              name="allowedOrigins"
              label="Allowed origins"
              description="Sites that can use this app from a browser. Leave empty to allow any site."
              placeholder="https://app.example.com"
              addLabel="Add origin"
            />
            <FormSwitch
              name="allowAnonymous"
              label="Allow anonymous users"
              description={
                anonymousWithoutOrigins ? (
                  <span className="text-amber-700 dark:text-amber-400">
                    Add at least one origin. Anonymous access is checked by the site it comes from.
                  </span>
                ) : (
                  "Visitors chat without signing in. The widget creates a user per browser."
                )
              }
            />
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
          {isEditing ? "Save changes" : "Create app"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
