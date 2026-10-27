import { Page } from "@/components/page";
import { Card, CardContent } from "@/components/ui/card";

export function SettingsPage() {
  return (
    <Page title="Settings" description="General system settings." documentTitle="Settings">
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          No settings yet. To debug agent runs, connect the Debug hook in Hooks and add it to an agent.
        </CardContent>
      </Card>
    </Page>
  );
}
