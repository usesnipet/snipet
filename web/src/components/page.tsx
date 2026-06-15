import { createContext, Suspense, useContext, useEffect, useLayoutEffect, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { ErrorFallback } from "./error-fallback";
import { LoadingFallback } from "./loading-fallback";

const PageActionsContext = createContext<((node: React.ReactNode) => void) | null>(null);

export type PageProps = {
  title: string;
  description: string;
  documentTitle: string;
  children: React.ReactNode;
  /** Prefer {@link PageActions} inside `content.tsx` when actions need colocation. */
  actions?: React.ReactNode;
};

export function Page({ title, description, documentTitle, children, actions }: PageProps) {
  const [slotActions, setSlotActions] = useState<React.ReactNode>(null);
  const headerActions = actions ?? slotActions;

  useEffect(() => {
    document.title = documentTitle;
  }, [documentTitle]);

  return (
    <PageActionsContext.Provider value={setSlotActions}>
        <div className="flex flex-1 flex-col gap-4 px-4 py-8 sm:px-6 lg:px-10 h-full">
          <div className="flex flex-col gap-2 divide-y h-full">
            <header className="pb-2 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
                <p className="text-muted-foreground text-sm">{description}</p>
              </div>
              {headerActions && <div>{headerActions}</div>}
            </header>
            <ErrorBoundary fallbackRender={({ error }) => <ErrorFallback error={error as Error} />}>
              <Suspense fallback={<LoadingFallback />}>
                {children}
              </Suspense>
            </ErrorBoundary>
          </div>
        </div>
    </PageActionsContext.Provider>
  );
}

/** Renders actions in the page header while keeping definition in `content.tsx`. */
export function PageActions({ children }: { children: React.ReactNode }) {
  const setActions = useContext(PageActionsContext);
  if (!setActions) {
    throw new Error("PageActions must be used within Page");
  }

  useLayoutEffect(() => {
    setActions(children);
    return () => setActions(null);
  });

  return null;
}
