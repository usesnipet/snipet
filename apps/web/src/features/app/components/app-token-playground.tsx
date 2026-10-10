import { FormInput } from "@/components/form/input";
import { FormTextarea } from "@/components/form/textarea";
import { JsonViewer } from "@/components/json-viewer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useIssueAppToken } from "@snipet/client";
import { Check, Copy, KeyRound } from "lucide-react";
import moment from "moment";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import type { AppTokenResponse } from "@snipet/shared";

const isJsonObject = (value: string) => {
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed);
  } catch {
    return false;
  }
};

const formSchema = z.object({
  apiKey: z.string().trim().min(1, "API key is required"),
  externalUserId: z.string().trim().min(1, "External user ID is required").max(255),
  name: z.string().trim().max(255),
  email: z.union([z.literal(""), z.email("Enter a valid email")]),
  metadata: z.string().refine((value) => !value.trim() || isJsonObject(value), "Must be a JSON object"),
  expiresInSeconds: z.coerce
    .number<string | number>()
    .int()
    .min(60, "At least 60 seconds")
    .max(86400, "At most 24 hours (86400 seconds)"),
});
type FormInput = z.input<typeof formSchema>;
type FormOutput = z.output<typeof formSchema>;

// decodeJwtPayload reads the token's claims for display only; it does not verify the signature.
const decodeJwtPayload = (token: string): unknown => {
  const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
};

export function AppTokenPlayground() {
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: { apiKey: "", externalUserId: "", name: "", email: "", metadata: "", expiresInSeconds: 3600 },
  });
  const { mutateAsync, isPending } = useIssueAppToken();
  const [result, setResult] = useState<AppTokenResponse | null>(null);

  const onSubmit = form.handleSubmit(async (values) => {
    setResult(await mutateAsync({
      apiKey: values.apiKey,
      data: {
        externalUserId: values.externalUserId,
        name: values.name,
        email: values.email,
        metadata: values.metadata.trim() ? (JSON.parse(values.metadata) as Record<string, unknown>) : undefined,
        expiresInSeconds: values.expiresInSeconds,
      }
    }));
  });

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Emit token</CardTitle>
          <CardDescription>
            The token belongs to the API key's app. In production, your app's backend makes this call.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={onSubmit} className="space-y-4">
              <FormInput name="apiKey" label="API key" type="password" autoComplete="off" placeholder="sk_..." />
              <FormInput name="externalUserId" label="External user ID" placeholder="user-123" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormInput name="name" label="Name" placeholder="Optional" />
                <FormInput name="email" label="Email" type="email" placeholder="Optional" />
              </div>
              <FormTextarea name="metadata" label="Metadata (JSON)" placeholder={'{ "plan": "pro" }'} rows={4} />
              <FormInput name="expiresInSeconds" label="Expires in (seconds)" type="number" min={60} max={86400} />
              <Button type="submit" disabled={isPending}>
                {isPending ? <Spinner size="sm" /> : <KeyRound />}
                Emit token
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {result ? (
        <TokenResult result={result} />
      ) : (
        <div className="text-muted-foreground flex items-center justify-center rounded-xl border border-dashed p-8 text-sm">
          The emitted token and its claims show up here.
        </div>
      )}
    </div>
  );
}

function TokenResult({ result }: { result: AppTokenResponse }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(result.token);
    setCopied(true);
    toast({ title: "Copied to clipboard" });
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Token</CardTitle>
          <CardDescription title={result.expiresAt.toLocaleString()}>
            Expires {moment(result.expiresAt).fromNow()}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input readOnly value={result.token} className="font-mono text-xs" containerclassname="w-full" />
          <Button type="button" variant="outline" size="icon-lg" onClick={copy} aria-label="Copy token">
            {copied ? <Check /> : <Copy />}
          </Button>
        </CardContent>
      </Card>
      <JsonViewer title="Claims" value={decodeJwtPayload(result.token)} />
    </div>
  );
}
