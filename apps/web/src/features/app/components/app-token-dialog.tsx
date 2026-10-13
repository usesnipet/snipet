import { FormInput } from "@/components/form/input";
import { FormTextarea } from "@/components/form/textarea";
import { SecretKeyDialog } from "@/components/secret-key-dialog";
import { Button } from "@/components/ui/button";
import {
  DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Spinner } from "@/components/ui/spinner";
import { useDialog } from "@/lib/dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { useIssueAppToken } from "@snipet/client";
import moment from "moment";
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

type AppTokenDialogProps = DialogInstanceProps<{ app: App }>;

// Issues an end-user token with one of the app's API keys, the same call the
// app's backend makes in production.
export function AppTokenDialog({ app, close }: AppTokenDialogProps) {
  const { openDialog } = useDialog();
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: { apiKey: "", externalUserId: "", name: "", email: "", metadata: "", expiresInSeconds: 3600 },
  });
  const { mutateAsync, isPending } = useIssueAppToken();

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
      },
    });
  });

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Generate token</DialogTitle>
        <DialogDescription>
          Issue an end-user token for <span className="font-medium text-foreground">{app.name}</span> with one of its
          API keys. In production, your app's backend makes this call.
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <FormInput name="apiKey" label="API key" type="password" autoComplete="off" placeholder="sk_..." />
          <FormInput name="externalUserId" label="External user ID" placeholder="user-123" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormInput name="name" label="Name" placeholder="Optional" />
            <FormInput name="email" label="Email" type="email" placeholder="Optional" />
          </div>
          <FormTextarea name="metadata" label="Metadata (JSON)" placeholder={'{ "plan": "pro" }'} rows={3} />
          <FormInput name="expiresInSeconds" label="Expires in (seconds)" type="number" min={60} max={86400} />
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending && <Spinner size="sm" />}
              Generate
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );
}
