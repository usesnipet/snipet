import { Button } from "@/components/ui/button";
import {
  DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Spinner } from "@/components/ui/spinner";
import { zodResolver } from "@hookform/resolvers/zod";
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
        <DialogTitle>Create LLM connection</DialogTitle>
        <DialogDescription>
          Add a named connection to a language model provider.
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <LlmFormFields />
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
  );
}
