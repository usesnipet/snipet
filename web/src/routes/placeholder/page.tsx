import { Page } from "@/components/page";

type Props = {
  title: string;
};

/** Temporary stub for sidebar destinations that don't have a real page yet. */
export function PlaceholderPage({ title }: Props) {
  return (
    <Page
      title={title}
      description="This section is coming soon."
      documentTitle={`${title} · Snipet`}
    >
      <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
        Coming soon
      </div>
    </Page>
  );
}
