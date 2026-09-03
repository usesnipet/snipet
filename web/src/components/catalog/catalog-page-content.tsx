import { PageActions } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export type CatalogPageContentProps = {
  createLabel: string;
  onCreate: () => void;
  children: React.ReactNode;
  actions?: React.ReactNode;
};

export function CatalogPageContent({ createLabel, onCreate, children, actions }: CatalogPageContentProps) {
  return (
    <>
      {actions && <PageActions>{actions}</PageActions>}
      {!actions && (
        <PageActions>
          <Button onClick={onCreate}>
            <Plus className="size-4" /> {createLabel}
          </Button>
        </PageActions>
      )}
      {children}
    </>
  );
}
