import { resolveDurationExpiresAt } from "@/components/duration-select";
import { FormDurationSelect } from "@/components/form/duration-select";
import { FormInput } from "@/components/form/input";
import { Button } from "@/components/ui/button";
import {
  DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { Form } from "@/components/ui/form";
import { Spinner } from "@/components/ui/spinner";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useCreateApiKey } from "../hooks";

import type { ApiKeyWithSecret } from "../schemas";
import type { DialogInstanceProps } from "@/lib/dialog";
const formSchema = z.object({
  name: z.string().min(1).max(255),
  expires_at: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

type CreateApiKeyDialogProps = DialogInstanceProps<{
  onCreated: (apiKey: ApiKeyWithSecret) => void
}>;

export function CreateApiKeyDialog({ onCreated, close }: CreateApiKeyDialogProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", expires_at: "" },
  });

  const { mutateAsync, isPending } = useCreateApiKey();

  const onSubmit = form.handleSubmit(async (values) => {
    const expiresAt = resolveDurationExpiresAt(values.expires_at);

    const result = await mutateAsync({
      data: {
        name: values.name,
        expires_at: expiresAt ? new Date(expiresAt) : undefined,
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
            <FormDurationSelect
              name="expires_at"
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
