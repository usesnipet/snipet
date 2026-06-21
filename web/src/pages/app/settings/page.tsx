import { Page } from "@/components/page";

import { SettingsContent } from "./content";

export function SettingsPage() {
  return (
    <Page
      title="Settings"
      description="Settings description"
      documentTitle="Settings"
    >
      <SettingsContent />
    </Page>
  )
}