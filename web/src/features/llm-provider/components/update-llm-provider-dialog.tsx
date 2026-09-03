import { Button } from "@/components/ui/button";
import {
  DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Spinner } from "@/components/ui/spinner";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { useUpdateLlmProvider } from "../hooks";
import { createLlmProviderSchema } from "../schemas";

import { LlmFormFields } from "./llm-form-fields";

import type { CreateLlmProvider, LlmProvider } from "../schemas";
import type { DialogInstanceProps } from "@/lib/dialog";

type UpdateLlmProviderDialogProps = DialogInstanceProps<{
  llm: LlmProvider;
}>;

export function UpdateLlmProviderDialog({ llm, close }: UpdateLlmProviderDialogProps) {
  const form = useForm<CreateLlmProvider>({
    resolver: zodResolver(createLlmProviderSchema),
    defaultValues: {
      name: llm.name,
      provider: llm.provider,
      config: llm.config,
    },
  });

  const { mutateAsync, isPending } = useUpdateLlmProvider();

  const onSubmit = form.handleSubmit(async (data) => {
    await mutateAsync({ id: llm.id, data });
    close();
  });

  return (
    <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Edit LLM</DialogTitle>
        <DialogDescription>
          Update settings for{" "}
          <span className="font-medium text-foreground">{llm.name}</span>.
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
              Save
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );
}
