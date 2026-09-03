import { Page } from "@/components/page";
import { Version } from "@/components/version";

export const HomePage = () => {
  return (
    <Page
      title="Home"
      description="Your orders workspace."
      documentTitle="Home"
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          This is the starter shell. Add a feature with the create-web-feature
          skill and a route in <code>src/router.tsx</code>.
        </p>
        <Version />
      </div>
    </Page>
  )
}
