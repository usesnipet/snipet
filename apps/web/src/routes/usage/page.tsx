import { Page } from "@/components/page";
import { UsageDashboard } from "@/features/usage/components/usage-dashboard";

export const UsagePage = () => (
  <Page title="Usage" description="How many tokens each agent used, day by day." documentTitle="Usage">
    <UsageDashboard />
  </Page>
);
