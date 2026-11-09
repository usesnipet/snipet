import { resolveDurationExpiresAt } from "@/components/duration-select";
import { FormDurationSelect } from "@/components/form/duration-select";
import { FormInput } from "@/components/form/input";
import { Button } from "@/components/ui/button";
import {
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
import { useForm } from "react-hook-form";

import { useCreateApiKey } from "@snipet/client";

import type { z } from "zod";

import type { App, CreateApiKey } from "@snipet/shared";
import type { DialogInstanceProps } from "@/lib/dialog";
type CreateApiKeyInput = z.input<typeof createApiKeySchema>;

type CreateApiKeyDialogProps = DialogInstanceProps<{
  /** The app that owns the new key. */
  app: Pick<App, "id" | "name">;
}>;

/** Creates a key for one app, then shows its secret once. */
export function CreateApiKeyDialog({ app, close }: CreateApiKeyDialogProps) {
  const { openDialog } = useDialog();
  const form = useForm<CreateApiKeyInput, unknown, CreateApiKey>({
    resolver: zodResolver(createApiKeySchema),
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
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>New API key</DialogTitle>
        <DialogDescription>
          Your backend uses it to issue tokens for <span className="font-medium text-foreground">{app.name}</span>{" "}
          users. The secret is shown only once.
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <FieldGroup>
            <FormInput name="name" label="Name" placeholder="Production" required />
            <FormDurationSelect name="expiresAt" label="Expiration" placeholder="Select duration" />
          </FieldGroup>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending && <Spinner size="sm" />}
              Create key
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );
}
