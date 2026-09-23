import { Icon } from "@/components/icon";
import { SchemaFormFields } from "@/components/schema-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronRight, CircleCheck } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { useCreateMcpServer } from "../hooks";
import { fromForm, toForm } from "../lib/config";
import { containsToken, fillPlaceholders, findPlaceholders } from "../lib/placeholders";
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

/** Fills a headers JSON Schema with the header values typed so far, empty ones dropped. */
function filledHeaders(values: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(values)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string" && !!entry[1].trim())
      .map(([key, value]) => [key, value.trim()]),
  );
}

/**
 * Installs a registry entry: renders the form its headers schema describes
 * and asks for the values its default config leaves as placeholders, with
 * the full config behind "Advanced".
 */
export function InstallMcpServerDialog({ item, installedCount = 0, close }: InstallMcpServerDialogProps) {
  const formId = `install-mcp-server-${useId()}`;
  const headersSchema = item.transport === "http" ? (item.config.headers_schema as RJSFSchema | undefined) : undefined;
  const baseConfig = useMemo(
    () => (item.transport === "http" ? { ...item.config, headers_schema: undefined } : item.config),
    [item],
  );
  const placeholders = useMemo(() => findPlaceholders(baseConfig), [baseConfig]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [missing, setMissing] = useState<string[]>([]);
  const [headerValues, setHeaderValues] = useState<Record<string, unknown>>({});
  const [headerErrors, setHeaderErrors] = useState<ErrorSchema>();
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const form = useForm<McpServerForm>({
    resolver: zodResolver(mcpServerFormSchema),
    defaultValues: toForm(
      installedCount ? `${item.name} ${installedCount + 1}` : item.name,
      item.transport,
      baseConfig,
    ),
  });

  const { mutateAsync: create, isPending } = useCreateMcpServer();

  const onSubmit = form.handleSubmit(async (formValues) => {
    const data = fromForm(formValues);
    // Only placeholders still present after any Advanced edits are required.
    const empty = placeholders
      .filter((p) => containsToken(data.config, p.token) && !values[p.token]?.trim())
      .map((p) => p.token);
    setMissing(empty);

    const headers = filledHeaders(headerValues);
    const missingHeaders = (headersSchema?.required ?? []).filter((key) => !headers[key]);
    setHeaderErrors(missingHeaders.length
      ? Object.fromEntries(missingHeaders.map((key) => [key, { __errors: ["Required to install this server."] }])) as ErrorSchema
      : undefined);
    if (empty.length || missingHeaders.length) return;

    const filled = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()]));
    const config = fillPlaceholders(data.config, filled);
    if ("url" in config && Object.keys(headers).length) {
      config.headers = { ...config.headers, ...headers };
    }
    await create({ ...data, config });
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

      {headersSchema && (
        <SchemaFormFields
          schema={headersSchema}
          onChange={setHeaderValues}
          extraErrors={headerErrors}
        />
      )}

      {placeholders.length > 0 && (
        <div className="space-y-3">
          {placeholders.map((placeholder) => {
            const inputId = `${formId}-${placeholder.token}`;
            const isMissing = missing.includes(placeholder.token);
            return (
              <div key={placeholder.token} className="space-y-1.5">
                <Label htmlFor={inputId}>{placeholder.label}</Label>
                <Input
                  id={inputId}
                  autoComplete="off"
                  value={values[placeholder.token] ?? ""}
                  onChange={(event) => setValues((prev) => ({ ...prev, [placeholder.token]: event.target.value }))}
                  placeholder={placeholder.token}
                  aria-invalid={isMissing}
                  className="font-mono text-xs"
                />
                <p className={cn("text-xs", isMissing ? "text-destructive" : "text-muted-foreground")}>
                  {isMissing ? "Required to install this server." : `Used in the ${placeholder.location}.`}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {!headersSchema && placeholders.length === 0 && (
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
