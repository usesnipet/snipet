import { Button } from "@/components/ui/button";
import {
  DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Spinner } from "@/components/ui/spinner";
import { zodResolver } from "@hookform/resolvers/zod";
import { useId } from "react";
import { useForm } from "react-hook-form";

import { useCreateMcpServer, useUpdateMcpServer } from "../hooks";
import { emptyForm, fromForm, toForm } from "../lib/config";
import { mcpServerFormSchema } from "../schemas";

import { McpServerFormFields } from "./mcp-server-form-fields";

import type { McpServer, McpServerForm } from "../schemas";
import type { DialogInstanceProps } from "@/lib/dialog";

type McpServerFormDialogProps = DialogInstanceProps<{
  /** When set, the dialog edits this server instead of adding a new one. */
  server?: McpServer;
}>;

export function McpServerFormDialog({ server, close }: McpServerFormDialogProps) {
  const isEditing = !!server;
  const formId = `mcp-server-form-${useId()}`;

  const form = useForm<McpServerForm>({
    resolver: zodResolver(mcpServerFormSchema),
    defaultValues: server ? toForm(server.name, server.transport, server.config) : emptyForm(),
  });

  const { mutateAsync: create, isPending: isCreating } = useCreateMcpServer();
  const { mutateAsync: update, isPending: isUpdating } = useUpdateMcpServer(server?.id ?? "");
  const isPending = isCreating || isUpdating;

  const onSubmit = form.handleSubmit(async (values) => {
    const data = fromForm(values);
    if (isEditing) await update(data);
    else await create(data);
    close();
  });

  return (
    <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{isEditing ? "Edit MCP server" : "Add custom MCP server"}</DialogTitle>
        <DialogDescription>
          {isEditing
            ? <>Update how Snipet reaches <span className="font-medium text-foreground">{server.name}</span>.</>
            : "Point Snipet at any MCP server by filling in how to reach it."}
        </DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form id={formId} onSubmit={onSubmit}>
          <McpServerFormFields />
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
          {isEditing ? "Save changes" : "Add server"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
