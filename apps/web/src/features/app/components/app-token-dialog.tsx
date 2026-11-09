import { FormInput } from "@/components/form/input";
import { FormSelect } from "@/components/form/select";
import { FormTextarea } from "@/components/form/textarea";
import { SecretKeyDialog } from "@/components/secret-key-dialog";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { useClipboard } from "@/hooks/use-clipboard";
import { useDialog } from "@/lib/dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { useIssueAppToken } from "@snipet/client";
import { ChevronDown, Copy } from "lucide-react";
import moment from "moment";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import type { App } from "@snipet/shared";
import type { DialogInstanceProps } from "@/lib/dialog";

const isJsonObject = (value: string) => {
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed);
  } catch {
    return false;
  }
};

/** Token lifetimes offered, in seconds; the API accepts 60 to 86400. */
const EXPIRY_OPTIONS = [
  { label: "15 minutes", value: String(15 * 60) },
  { label: "1 hour", value: String(60 * 60) },
  { label: "24 hours", value: String(24 * 60 * 60) },
];

const formSchema = z.object({
  apiKey: z.string().trim().min(1, "API key is required"),
  externalUserId: z.string().trim().min(1, "External user ID is required").max(255),
  name: z.string().trim().max(255),
  email: z.union([z.literal(""), z.email("Enter a valid email")]),
  metadata: z.string().refine((value) => !value.trim() || isJsonObject(value), "Must be a JSON object"),
  expiresInSeconds: z.coerce.number<string>().int().min(60).max(86400),
});
type FormInput = z.input<typeof formSchema>;
type FormOutput = z.output<typeof formSchema>;

type AppTokenDialogProps = DialogInstanceProps<{ app: App }>;

/** Issues an end-user token with one of the app's API keys, the same call the app's backend makes in production. */
export function AppTokenDialog({ app, close }: AppTokenDialogProps) {
  const { openDialog } = useDialog();
  const formId = `app-token-form-${useId()}`;
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: { apiKey: "", externalUserId: "", name: "", email: "", metadata: "", expiresInSeconds: "3600" },
  });
  const { mutateAsync, isPending } = useIssueAppToken();
  const [showDetails, setShowDetails] = useState(false);
  // An error in a collapsed field would block submit without showing why.
  const detailsHaveErrors = ["name", "email", "metadata"].some((field) => field in form.formState.errors);

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await mutateAsync({
      apiKey: values.apiKey,
      data: {
        appId: app.id,
        externalUserId: values.externalUserId,
        name: values.name,
        email: values.email,
        metadata: values.metadata.trim() ? (JSON.parse(values.metadata) as Record<string, unknown>) : undefined,
        expiresInSeconds: values.expiresInSeconds,
      },
    });
    close();
    openDialog({
      component: SecretKeyDialog,
      props: {
        secret: result.token,
        title: "Token generated",
        description: `Expires ${moment(result.expiresAt).fromNow()}. Copy it now, it will not be shown again.`,
        children: <WidgetSnippet token={result.token} />,
      },
    });
  });

  return (
    <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Generate token</DialogTitle>
        <DialogDescription>
          Get a token for a test user of <span className="font-medium text-foreground">{app.name}</span> to try the
          widget or the API as them. Your backend does this for real users.
        </DialogDescription>
      </DialogHeader>
      <DialogBody>
        <Form {...form}>
          <form id={formId} onSubmit={onSubmit} className="flex flex-col gap-4">
            <FormInput name="apiKey" label="API key" type="password" autoComplete="off" placeholder="sk_..." />
            <FormInput name="externalUserId" label="External user ID" placeholder="user-123" />
            <FormSelect name="expiresInSeconds" label="Expires in" options={EXPIRY_OPTIONS} />
            <Collapsible open={showDetails || detailsHaveErrors} onOpenChange={setShowDetails}>
              <CollapsibleTrigger asChild>
                <Button type="button" variant="ghost" size="sm" className="group -ml-2">
                  <ChevronDown className="transition-transform group-data-[state=open]:rotate-180" />
                  More user details
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="flex flex-col gap-4 pt-2">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormInput name="name" label="Name" placeholder="Optional" />
                  <FormInput name="email" label="Email" type="email" placeholder="Optional" />
                </div>
                <FormTextarea name="metadata" label="Metadata (JSON)" placeholder={'{ "plan": "pro" }'} rows={3} />
              </CollapsibleContent>
            </Collapsible>
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
          Generate
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

/** Widget setup with the new token filled in: the next step after generating one. */
function WidgetSnippet({ token }: { token: string }) {
  const { copy } = useClipboard();
  const snippet = `SnipetWidget.init({
  apiUrl: "${window.location.origin}",
  agentId: "<your agent id>",
  token: "${token}",
});`;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Try it in the widget</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => copy(snippet, { successTitle: "Snippet copied", errorTitle: "Failed to copy snippet" })}
        >
          <Copy />
          Copy
        </Button>
      </div>
      <pre className="bg-muted overflow-x-auto rounded-md p-3 font-mono text-xs">{snippet}</pre>
    </div>
  );
}
