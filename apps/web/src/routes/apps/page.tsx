import { CatalogPageContent } from "@/components/catalog";
import { Page } from "@/components/page";
import { AppCatalog } from "@/features/app/components/app-catalog";
import { AppFormDialog } from "@/features/app/components/dialogs";
import { useDialog } from "@/lib/dialog";

export const AppsPage = () => {
  const { openDialog } = useDialog();

  return (
    <Page
      title="Apps"
      description="Each app is a site or product where people chat with your agents. It holds the API keys and decides who can chat."
      documentTitle="Apps"
    >
      <CatalogPageContent createLabel="Create app" onCreate={() => openDialog({ component: AppFormDialog, props: {} })}>
        <AppCatalog />
      </CatalogPageContent>
    </Page>
  );
};
