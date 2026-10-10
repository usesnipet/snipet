import { Page } from "@/components/page";
import { AppTokenPlayground } from "@/features/app/components/app-token-playground";

export const AppTokenPlaygroundPage = () => (
  <Page
    title="Token playground"
    description="Emit an end-user token with an app's API key, to test what your widget or frontend will receive."
    documentTitle="Token playground · Snipet"
  >
    <AppTokenPlayground />
  </Page>
);
