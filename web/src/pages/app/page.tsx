import { Page } from "@/components/page";

import { HomeContent } from "./content";

export function HomePage() {
  return (
    <Page
      title="Home"
      description="Home description"
      documentTitle="Home"
    >
      <HomeContent />
    </Page>
  )
}