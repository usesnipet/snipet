import { resolveDurationExpiresAt } from "@/components/duration-select";
import { FormDurationSelect } from "@/components/form/duration-select";
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

import { useUpdateExpirationApiKey } from "../hooks";

import type { ApiKey } from "../schemas";
import type { DialogInstanceProps } from "@/lib/dialog";
const formSchema = z.object({
  expires_at: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

function toDatetimeLocalValue(date?: Date | null) {
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

type UpdateApiKeyExpirationDialogProps = DialogInstanceProps<{
  apiKey: ApiKey
}>;

export function UpdateApiKeyExpirationDialog({ apiKey, close }: UpdateApiKeyExpirationDialogProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { expires_at: toDatetimeLocalValue(apiKey.expires_at) },
  });

  const { mutateAsync, isPending } = useUpdateExpirationApiKey();

  const onSubmit = form.handleSubmit(async (values) => {
    const expiresAt = resolveDurationExpiresAt(values.expires_at);

    await mutateAsync({
      id: apiKey.id,
      data: {
        expires_at: expiresAt ? new Date(expiresAt) : undefined,
      },
    });
    close();
  });

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Update expiration</DialogTitle>
        <DialogDescription>
          Set a new expiration date for{" "}
          <span className="font-medium text-foreground">{apiKey.name}</span>.
          Leave empty to remove expiration.
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <FieldGroup>
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
              Save
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  )
}
