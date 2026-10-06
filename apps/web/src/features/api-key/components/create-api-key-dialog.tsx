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
import { FormAppSelect } from "@/features/app/components/app-select";
import { zodResolver } from "@hookform/resolvers/zod";
import { createApiKeySchema } from "@snipet/shared";
import { useForm } from "react-hook-form";

import { useCreateApiKey } from "@snipet/client";

import type { z } from "zod";

import type { ApiKeyWithSecret, CreateApiKey } from "@snipet/shared";
import type { DialogInstanceProps } from "@/lib/dialog";
type CreateApiKeyInput = z.input<typeof createApiKeySchema>;

type CreateApiKeyDialogProps = DialogInstanceProps<{
  onCreated: (apiKey: ApiKeyWithSecret) => void
}>;

export function CreateApiKeyDialog({ onCreated, close }: CreateApiKeyDialogProps) {
  const form = useForm<CreateApiKeyInput, unknown, CreateApiKey>({
    resolver: zodResolver(createApiKeySchema),
    defaultValues: { name: "", expiresAt: null, appId: "" },
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
    form.reset();
    onCreated(result);
    close();
  });

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Create API Key</DialogTitle>
        <DialogDescription>
          Create a new API key. The secret will be shown only once.
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <FieldGroup>
            <FormInput
              name="name"
              label="Name"
              placeholder="Production"
              required
            />
            <FormAppSelect
              name="appId"
              label="App"
              placeholder="Select app"
            />
            <FormDurationSelect
              name="expiresAt"
              label="Expiration"
              placeholder="Select duration"
            />
          </FieldGroup>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending && <Spinner size="sm" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  )
}
