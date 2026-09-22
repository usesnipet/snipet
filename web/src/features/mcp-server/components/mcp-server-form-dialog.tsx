import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { useId, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { useCreateMcpServer, useUpdateMcpServer } from "../hooks";
import { describeConfig, emptyForm, fromForm, toForm } from "../lib/config";
import { parseMcpJson } from "../lib/import-json";
import { mcpServerFormSchema } from "../schemas";

import { McpServerFormFields } from "./mcp-server-form-fields";

import type { McpServer, McpServerForm } from "../schemas";
import type { DialogInstanceProps } from "@/lib/dialog";

type Mode = "form" | "json";

type McpServerFormDialogProps = DialogInstanceProps<{
  /** When set, the dialog edits this server instead of adding a new one. */
  server?: McpServer;
}>;

const JSON_EXAMPLE = `{
  "mcpServers": {
    "memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"]
    }
  }
}`;

export function McpServerFormDialog({ server, close }: McpServerFormDialogProps) {
  const isEditing = !!server;
  const formId = `mcp-server-form-${useId()}`;
  const [mode, setMode] = useState<Mode>("form");
  const [json, setJson] = useState("");

  const form = useForm<McpServerForm>({
    resolver: zodResolver(mcpServerFormSchema),
    defaultValues: server ? toForm(server.name, server.transport, server.config) : emptyForm(),
  });

  const { mutateAsync: create, isPending: isCreating } = useCreateMcpServer();
  const { mutateAsync: update, isPending: isUpdating } = useUpdateMcpServer(server?.id ?? "");
  const isPending = isCreating || isUpdating;

  const imported = useMemo(() => {
    if (!json.trim()) return null;
    try {
      return { ...parseMcpJson(json), error: undefined };
    } catch (error) {
      return { servers: [], warnings: [], error: (error as Error).message };
    }
  }, [json]);

  const onSubmitForm = form.handleSubmit(async (values) => {
    const data = fromForm(values);
    if (isEditing) await update(data);
    else await create(data);
    close();
  });

  const onSubmitJson = async () => {
    if (!imported?.servers.length) return;
    for (const data of imported.servers) await create(data);
    close();
  };

  const canSubmit = mode === "form" || !!imported?.servers.length;
  const submitLabel = isEditing
    ? "Save changes"
    : mode === "json" && imported?.servers.length
      ? `Add ${imported.servers.length} server${imported.servers.length === 1 ? "" : "s"}`
      : "Add server";

  return (
    <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{isEditing ? "Edit MCP server" : "Add custom MCP server"}</DialogTitle>
        <DialogDescription>
          {isEditing
            ? <>Update how Snipet reaches <span className="font-medium text-foreground">{server.name}</span>.</>
            : "Point Snipet at any MCP server — fill in the details, or paste the JSON snippet from its README."}
        </DialogDescription>
      </DialogHeader>

      <Tabs value={mode} onValueChange={(value) => setMode(value as Mode)}>
        {!isEditing && (
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="form">Fill in details</TabsTrigger>
            <TabsTrigger value="json">Paste JSON</TabsTrigger>
          </TabsList>
        )}

        <TabsContent value="form" className="mt-4">
          <Form {...form}>
            <form id={formId} onSubmit={onSubmitForm}>
              <McpServerFormFields />
            </form>
          </Form>
        </TabsContent>

        <TabsContent value="json" className="mt-4 space-y-3">
          <Textarea
            value={json}
            onChange={(event) => setJson(event.target.value)}
            placeholder={JSON_EXAMPLE}
            rows={9}
            spellCheck={false}
            className="font-mono text-xs"
            aria-label="MCP server JSON"
          />
          <p className="text-muted-foreground text-xs">
            Accepts the <code>mcpServers</code> block used by Claude Desktop and Cursor, VS Code's{" "}
            <code>servers</code> block, or a single server object.
          </p>
          {imported?.error && (
            <Alert variant="destructive">
              <AlertDescription>{imported.error}</AlertDescription>
            </Alert>
          )}
          {!!imported?.servers.length && (
            <div className="space-y-2">
              {imported.servers.map((item) => (
                <div key={item.name} className="flex items-center gap-2 rounded-lg border bg-muted/30 p-2.5">
                  <span className="text-sm font-medium">{item.name}</span>
                  <Badge variant="outline" className="font-normal">{item.transport}</Badge>
                  <code className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
                    {describeConfig(item)}
                  </code>
                </div>
              ))}
              {imported.warnings.map((warning) => (
                <p key={warning} className="text-xs text-amber-600 dark:text-amber-400">{warning}</p>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" disabled={isPending}>
            Cancel
          </Button>
        </DialogClose>
        {mode === "form" ? (
          <Button type="submit" form={formId} disabled={isPending}>
            {isPending && <Spinner size="sm" />}
            {submitLabel}
          </Button>
        ) : (
          <Button type="button" disabled={isPending || !canSubmit} onClick={onSubmitJson}>
            {isPending && <Spinner size="sm" />}
            {submitLabel}
          </Button>
        )}
      </DialogFooter>
    </DialogContent>
  );
}
