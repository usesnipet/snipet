import { FormInput } from "@/components/form/input";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Globe, Plus, Terminal, X } from "lucide-react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";

import type { McpServerForm, McpTransport } from "../schemas";

const TRANSPORTS: { value: McpTransport; label: string; hint: string; icon: React.ReactNode }[] = [
  { value: "stdio", label: "Local command", hint: "Runs a process (npx, uvx, docker…)", icon: <Terminal /> },
  { value: "http", label: "Remote URL", hint: "Connects to a hosted server over HTTP", icon: <Globe /> },
];

type Props = {
  /** Hides the transport picker, e.g. when installing a registry entry whose transport is fixed. */
  hideTransport?: boolean;
};

export function McpServerFormFields({ hideTransport }: Props) {
  const form = useFormContext<McpServerForm>();
  const transport = useWatch({ control: form.control, name: "transport" });

  return (
    <FieldGroup>
      <FormInput name="name" label="Name" placeholder="e.g. GitHub" required />

      {!hideTransport && (
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Transport">
          {TRANSPORTS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={transport === option.value}
              onClick={() => form.setValue("transport", option.value, { shouldDirty: true })}
              className={cn(
                "flex items-start gap-2.5 rounded-lg border p-3 text-left transition-colors [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0",
                transport === option.value
                  ? "border-primary bg-primary/5"
                  : "hover:border-primary/40",
              )}
            >
              {option.icon}
              <span className="space-y-0.5">
                <span className="block text-sm font-medium leading-none">{option.label}</span>
                <span className="text-muted-foreground block text-xs">{option.hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {transport === "stdio" ? (
        <FormInput
          name="commandLine"
          label="Command"
          placeholder="npx -y @modelcontextprotocol/server-memory"
          description="The full command line, arguments included. Quote arguments that contain spaces."
          className="font-mono text-xs"
        />
      ) : (
        <>
          <FormInput name="url" label="Server URL" placeholder="https://example.com/mcp" className="font-mono text-xs" />
          <HeadersField />
        </>
      )}

      <FormInput
        name="timeout"
        label="Timeout (seconds)"
        inputMode="numeric"
        placeholder="30"
        fieldclassname="max-w-40"
      />
    </FieldGroup>
  );
}

function HeadersField() {
  const form = useFormContext<McpServerForm>();
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "headers" });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Headers</Label>
        <Button type="button" variant="ghost" size="sm" onClick={() => append({ key: "", value: "" })}>
          <Plus />
          Add header
        </Button>
      </div>
      {fields.length === 0 ? (
        <p className="text-muted-foreground text-xs">No headers. Add one for auth, e.g. Authorization: Bearer …</p>
      ) : (
        fields.map((field, index) => (
          <div key={field.id} className="flex items-center gap-2">
            <Input
              {...form.register(`headers.${index}.key`)}
              placeholder="Authorization"
              className="font-mono text-xs"
            />
            <Input
              {...form.register(`headers.${index}.value`)}
              type="password"
              autoComplete="off"
              placeholder="Bearer …"
              className="flex-1 font-mono text-xs"
            />
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove header" onClick={() => remove(index)}>
              <X />
            </Button>
          </div>
        ))
      )}
    </div>
  );
}
