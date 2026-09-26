import { Icon } from "@/components/icon";
import { SchemaFormFields } from "@/components/schema-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import validator from "@rjsf/validator-ajv8";
import { ChevronRight, CircleCheck } from "lucide-react";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";

import { useCreateMcpServer } from "../hooks";
import { fromForm, toForm } from "../lib/config";
import { mcpServerFormSchema } from "../schemas";

import { McpServerFormFields } from "./mcp-server-form-fields";

import type { McpServerForm, McpServerRegistryItem } from "../schemas";
import type { DialogInstanceProps } from "@/lib/dialog";
import type { ErrorSchema, RJSFSchema } from "@rjsf/utils";

type InstallMcpServerDialogProps = DialogInstanceProps<{
  item: McpServerRegistryItem;
  /** How many servers already use this entry — used to suggest a distinct name. */
  installedCount?: number;
}>;

/** Trims the values typed into the schema form, dropping empty ones so `required`/`minItems` catch them. */
function cleanValues(values: unknown): Record<string, string> | string[] {
  const filled = (value: unknown): value is string => typeof value === "string" && !!value.trim();
  if (Array.isArray(values)) return values.filter(filled).map((value) => value.trim());
  return Object.fromEntries(
    Object.entries(values ?? {})
      .filter((entry): entry is [string, string] => filled(entry[1]))
      .map(([key, value]) => [key, value.trim()]),
  );
}

/**
 * Installs a registry entry: renders the form its headers schema (http) or
 * args schema (stdio) describes, with the full config behind "Advanced".
 */
export function InstallMcpServerDialog({ item, installedCount = 0, close }: InstallMcpServerDialogProps) {
  const formId = `install-mcp-server-${useId()}`;
  const schema = (item.transport === "http" ? item.config.headers_schema : item.config.args_schema) as
    | RJSFSchema
    | undefined;
  const [schemaValues, setSchemaValues] = useState<unknown>();
  const [schemaErrors, setSchemaErrors] = useState<ErrorSchema>();
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const form = useForm<McpServerForm>({
    resolver: zodResolver(mcpServerFormSchema),
    defaultValues: toForm(
      installedCount ? `${item.name} ${installedCount + 1}` : item.name,
      item.transport,
      item.config,
    ),
  });

  const { mutateAsync: create, isPending } = useCreateMcpServer();

  const onSubmit = form.handleSubmit(async (formValues) => {
    const data = fromForm(formValues);
    if (schema) {
      const values = cleanValues(schemaValues);
      const { errors, errorSchema } = validator.validateFormData(values, schema);
      setSchemaErrors(errors.length ? errorSchema : undefined);
      if (errors.length) return;

      if (Array.isArray(values)) {
        if ("command" in data.config) data.config.args = [...(data.config.args ?? []), ...values];
      } else if ("url" in data.config) {
        data.config.headers = { ...data.config.headers, ...values };
      }
    }
    await create(data);
    close();
  }, () => setAdvancedOpen(true));

  return (
    <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <div className="flex items-start gap-3">
          <Icon name={item.name} icon={item.icon} className="size-10" />
          <div className="min-w-0 space-y-1.5">
            <DialogTitle>Install {item.name}</DialogTitle>
            <DialogDescription>{item.description}</DialogDescription>
            <div className="flex flex-wrap gap-1">
              {item.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-muted-foreground font-normal">{tag}</Badge>
              ))}
            </div>
          </div>
        </div>
      </DialogHeader>

      {schema && (
        <SchemaFormFields
          schema={schema}
          onChange={setSchemaValues}
          extraErrors={schemaErrors}
        />
      )}

      {!schema && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
          <CircleCheck className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          Nothing to configure — ready to install.
        </div>
      )}

      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs font-medium"
          >
            <ChevronRight className={cn("size-3.5 transition-transform", advancedOpen && "rotate-90")} />
            Advanced settings
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <Form {...form}>
            <form id={formId} onSubmit={onSubmit}>
              <McpServerFormFields hideTransport />
            </form>
          </Form>
        </CollapsibleContent>
      </Collapsible>

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" disabled={isPending}>
            Cancel
          </Button>
        </DialogClose>
        <Button type="button" disabled={isPending} onClick={onSubmit}>
          {isPending && <Spinner size="sm" />}
          Install
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
