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
import { useId } from "react";
import { useForm } from "react-hook-form";

import { useDialog } from "@/lib/dialog";

import { useCreateLlmConnection, useUpdateLlmConnection } from "@snipet/client";
import { createLlmConnectionSchema } from "@snipet/shared";

import { TestLlmConnectionDialog } from "./dialogs";
import { LlmFormFields } from "./llm-form-fields";

import type { CreateLlmConnection, LlmConnection } from "@snipet/shared";

import type { DialogInstanceProps } from "@/lib/dialog";

type CreateLlmConnectionDialogProps = DialogInstanceProps<{
  onSaved?: (llm: LlmConnection) => void;
  defaultValues?: Partial<CreateLlmConnection>;
  llm?: LlmConnection;
}>;

const DEFAULT_VALUES: CreateLlmConnection = {
  name: "",
  llmKey: "",
  config: {},
  enabled: true,
};

export function CreateLlmConnectionDialog({ onSaved, close, defaultValues, llm }: CreateLlmConnectionDialogProps) {
  const isEditing = !!llm;
  // Opened from a provider (its card, its list) or editing: the provider is settled, and
  // switching it would leave a config that belongs to another schema.
  const isLlmLocked = isEditing || !!defaultValues?.llmKey;
  const { openDialog } = useDialog();
  const mergedDefaultValues = llm
    ? { name: llm.name, llmKey: llm.llmKey, config: llm.config, enabled: llm.enabled }
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
      close();
      // A sync only proves the key lists models; the test shows it generates text.
      openDialog({ component: TestLlmConnectionDialog, props: { connection: result, isNew: true } });
      return;
    }
    close();
  });

  return (
    <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{isEditing ? "Edit LLM connection" : "New LLM connection"}</DialogTitle>
        <DialogDescription>
          {isEditing ? (
            <>
              Update settings for <span className="font-medium text-foreground">{llm.name}</span>.
            </>
          ) : (
            "Add your API key or local server. Your agents can use it once it's saved."
          )}
        </DialogDescription>
      </DialogHeader>
      <DialogBody>
        <Form {...form}>
          <form id={formId} onSubmit={onSubmit}>
            <LlmFormFields isLlmLocked={isLlmLocked} />
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
          {isEditing ? "Save changes" : "Create connection"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
