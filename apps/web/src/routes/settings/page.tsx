import { Page } from "@/components/page";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { useSystemSettings } from "@/context/settings-context";
import { useUpdateSettings } from "@snipet/client";

export function SettingsPage() {
  const settings = useSystemSettings();
  const { mutate: update, isPending } = useUpdateSettings();

  return (
    <Page title="Settings" description="General system settings." documentTitle="Settings">
      <Card>
        <CardContent className="pt-6">
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="agent-debug">Debug mode</FieldLabel>
              <FieldDescription>Saves what goes in and out of each agent run, to debug its answers.</FieldDescription>
            </FieldContent>
            <Switch
              id="agent-debug"
              checked={settings.agentDebugEnabled}
              disabled={isPending}
              onCheckedChange={(agentDebugEnabled) => update({ agentDebugEnabled })}
            />
          </Field>
        </CardContent>
      </Card>
    </Page>
  );
}
