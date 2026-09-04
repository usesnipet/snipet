import { Button } from "@/components/ui/button";
import {
  DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Spinner } from "@/components/ui/spinner";
import { zodResolver } from "@hookform/resolvers/zod";
import { useId } from "react";
import { useForm } from "react-hook-form";

import { useCreateLlmConnection } from "../hooks";
import { createLlmConnectionSchema } from "../schemas";

import { LlmFormFields } from "./llm-form-fields";

import type { CreateLlmConnection, LlmConnection } from "../schemas";

import type { DialogInstanceProps } from "@/lib/dialog";

type CreateLlmConnectionDialogProps = DialogInstanceProps<{
  onCreated?: (llm: LlmConnection) => void;
}>;

const defaultValues: CreateLlmConnection = {
  name: "",
  provider: "",
  config: {},
  enabled: true
};

export function CreateLlmConnectionDialog({ onCreated, close }: CreateLlmConnectionDialogProps) {
  const formId = `create-llm-connection-${useId()}`;
  const form = useForm<CreateLlmConnection>({
    resolver: zodResolver(createLlmConnectionSchema),
    defaultValues,
  });

  const { mutateAsync, isPending } = useCreateLlmConnection();

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await mutateAsync({ data: values });
    form.reset();
    onCreated?.(result);
    close();
  });

  return (
    <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>New LLM connection</DialogTitle>
        <DialogDescription>
          Point at a provider and drop in your API key — it becomes available to your agents.
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
          Create connection
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
