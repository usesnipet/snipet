import { Page, PageActions } from "@/components/page";
import { Button } from "@/components/ui/button";
import { CreateUserDialog } from "@/features/users/components/create-user-dialog";
import { UsersTable } from "@/features/users/components/users-table";
import { useDialog } from "@/lib/dialog";
import { Plus } from "lucide-react";

export const UsersPage = () => {
  const { openDialog } = useDialog();

  const openCreate = () => {
    openDialog({ component: CreateUserDialog, props: {} });
  };

  return (
    <Page
      title="Users"
      description="Manage who can sign in to Snipet and what they can do."
      documentTitle="Users"
    >
      <PageActions>
        <Button onClick={openCreate}>
          <Plus className="size-4" /> Add user
        </Button>
      </PageActions>
      <UsersTable />
    </Page>
  );
};
