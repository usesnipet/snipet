import { Button } from "@/components/ui/button";
import {
  DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Spinner } from "@/components/ui/spinner";
import { zodResolver } from "@hookform/resolvers/zod";
import { useId } from "react";
import { useForm } from "react-hook-form";

import { useCreateLlmConnection, useUpdateLlmConnection } from "../hooks";
import { createLlmConnectionSchema } from "../schemas";

import { LlmFormFields } from "./llm-form-fields";

import type { CreateLlmConnection, LlmConnection } from "../schemas";

import type { DialogInstanceProps } from "@/lib/dialog";

type CreateLlmConnectionDialogProps = DialogInstanceProps<{
  onSaved?: (llm: LlmConnection) => void;
  defaultValues?: Partial<CreateLlmConnection>;
  llm?: LlmConnection;
}>;

const DEFAULT_VALUES: CreateLlmConnection = {
  name: "",
  provider: "",
  config: {},
  enabled: true
};

export function CreateLlmConnectionDialog({ onSaved, close, defaultValues, llm }: CreateLlmConnectionDialogProps) {
  const isEditing = !!llm;
  const mergedDefaultValues = llm
    ? { name: llm.name, provider: llm.provider, config: llm.config, enabled: llm.enabled }
    : { ...DEFAULT_VALUES, ...defaultValues };
  const formId = `create-llm-connection-${useId()}`;
  const form = useForm<CreateLlmConnection>({
    resolver: zodResolver(createLlmConnectionSchema),
    defaultValues: mergedDefaultValues,
  });

  const { mutateAsync: create, isPending: isCreating } = useCreateLlmConnection();
  const { mutateAsync: update, isPending: isUpdating } = useUpdateLlmConnection();
  const isPending = isCreating || isUpdating;

  const onSubmit = form.handleSubmit(async (values) => {
    if (isEditing) {
      await update({ id: llm.id, data: values });
      onSaved?.({ ...llm, ...values });
    } else {
      const result = await create({ data: values });
      form.reset();
      onSaved?.(result);
    }
    close();
  });

  return (
    <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{isEditing ? "Edit LLM connection" : "New LLM connection"}</DialogTitle>
        <DialogDescription>
          {isEditing
            ? <>Update settings for <span className="font-medium text-foreground">{llm.name}</span>.</>
            : "Point at a provider and drop in your API key — it becomes available to your agents."}
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
          {isEditing ? "Save changes" : "Create connection"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
