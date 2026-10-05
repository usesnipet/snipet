import { CatalogPageContent } from "@/components/catalog";
import { Page } from "@/components/page";
import { AppCatalog } from "@/features/app/components/app-catalog";
import { AppFormDialog } from "@/features/app/components/app-form-dialog";
import { useDialog } from "@/lib/dialog";

export const AppsPage = () => {
  const { openDialog } = useDialog();

  return (
    <Page
      title="Apps"
      description="Register the clients that talk to your agents. Each app owns its API keys and sessions, and can be locked to the origins it runs on."
      documentTitle="Apps"
    >
      <CatalogPageContent
        createLabel="Create app"
        onCreate={() => openDialog({ component: AppFormDialog, props: {} })}
      >
        <AppCatalog />
      </CatalogPageContent>
    </Page>
  );
};
