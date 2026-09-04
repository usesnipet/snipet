import { Button } from "@/components/ui/button";
import {
  DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Spinner } from "@/components/ui/spinner";
import { zodResolver } from "@hookform/resolvers/zod";
import { useId } from "react";
import { useForm } from "react-hook-form";

import { useUpdateLlmConnection } from "../hooks";
import { createLlmConnectionSchema } from "../schemas";

import { LlmFormFields } from "./llm-form-fields";

import type { CreateLlmConnection, LlmConnection } from "../schemas";
import type { DialogInstanceProps } from "@/lib/dialog";

type UpdateLlmConnectionDialogProps = DialogInstanceProps<{
  llm: LlmConnection;
}>;

export function UpdateLlmConnectionDialog({ llm, close }: UpdateLlmConnectionDialogProps) {
  const formId = `update-llm-connection-${useId()}`;
  const form = useForm<CreateLlmConnection>({
    resolver: zodResolver(createLlmConnectionSchema),
    defaultValues: {
      name: llm.name,
      provider: llm.provider,
      config: llm.config,
      enabled: llm.enabled,
    },
  });

  const { mutateAsync, isPending } = useUpdateLlmConnection();

  const onSubmit = form.handleSubmit(async (data) => {
    await mutateAsync({ id: llm.id, data });
    close();
  });

  return (
    <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Edit LLM connection</DialogTitle>
        <DialogDescription>
          Update settings for{" "}
          <span className="font-medium text-foreground">{llm.name}</span>.
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form id={formId} onSubmit={onSubmit}>
          <LlmFormFields />
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
          Save changes
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
