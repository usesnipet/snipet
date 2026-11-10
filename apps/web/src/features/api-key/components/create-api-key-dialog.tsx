import { resolveDurationExpiresAt } from "@/components/duration-select";
import { FormDurationSelect } from "@/components/form/duration-select";
import { FormInput } from "@/components/form/input";
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
import { FieldGroup } from "@/components/ui/field";
import { Form } from "@/components/ui/form";
import { Spinner } from "@/components/ui/spinner";
import { SecretKeyDialog } from "@/components/secret-key-dialog";
import { useDialog } from "@/lib/dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { createApiKeySchema } from "@snipet/shared";
import { useId } from "react";
import { useForm } from "react-hook-form";

import { useCreateApiKey } from "@snipet/client";

import { z } from "zod";

import type { App } from "@snipet/shared";
import type { DialogInstanceProps } from "@/lib/dialog";

/** The select holds a duration ("1m", "never"); it becomes a date only on submit. */
const formSchema = createApiKeySchema.extend({ expiresAt: z.string().nullable() });
type FormValues = z.infer<typeof formSchema>;

type CreateApiKeyDialogProps = DialogInstanceProps<{
  /** The app that owns the new key. */
  app: Pick<App, "id" | "name">;
}>;

/** Creates a key for one app, then shows its secret once. */
export function CreateApiKeyDialog({ app, close }: CreateApiKeyDialogProps) {
  const { openDialog } = useDialog();
  const formId = `create-api-key-${useId()}`;
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", expiresAt: null, appId: app.id },
  });

  const { mutateAsync, isPending } = useCreateApiKey();

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await mutateAsync({
      data: {
        name: values.name,
        expiresAt: resolveDurationExpiresAt(values.expiresAt),
        appId: values.appId,
      },
    });
    close();
    openDialog({
      component: SecretKeyDialog,
      props: {
        secret: result.key,
        title: "API key created",
        description: "Copy this key now and store it on your backend. It will not be shown again.",
      },
    });
  });

  return (
    <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-md">
      <DialogHeader>
        <DialogTitle>New API key</DialogTitle>
        <DialogDescription>
          Your backend uses it to issue tokens for <span className="font-medium text-foreground">{app.name}</span>{" "}
          users. The secret is shown only once.
        </DialogDescription>
      </DialogHeader>
      <DialogBody>
        <Form {...form}>
          <form id={formId} onSubmit={onSubmit} className="flex flex-col gap-4">
            <FieldGroup>
              <FormInput name="name" label="Name" placeholder="Production" required />
              <FormDurationSelect name="expiresAt" label="Expiration" placeholder="Select duration" />
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
          Create key
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
