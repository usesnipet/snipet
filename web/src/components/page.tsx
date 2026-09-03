import { createContext, Suspense, useContext, useEffect, useLayoutEffect, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { ErrorFallback } from "./error-fallback";
import { LoadingFallback } from "./loading-fallback";

type PageActionsContextType = {
  setActions: (node: React.ReactNode) => void;
  setLeftActions: (node: React.ReactNode) => void;
};

const PageActionsContext = createContext<PageActionsContextType | null>(null);

export type PageProps = {
  title: string;
  description: string;
  documentTitle: string;
  children: React.ReactNode;
  /** Prefer {@link PageActions} inside `content.tsx` when actions need colocation. */
  actions?: React.ReactNode;
  leftActions?: React.ReactNode;
};

export function Page({ title, description, documentTitle, children, actions, leftActions }: PageProps) {
  const [slotActions, setSlotActions] = useState<React.ReactNode>(null);
  const [slotLeftActions, setSlotLeftActions] = useState<React.ReactNode>(null);

  const headerActions = actions ?? slotActions;
  const headerLeftActions = leftActions ?? slotLeftActions;

  useEffect(() => {
    document.title = documentTitle;
  }, [documentTitle]);

  return (
    <PageActionsContext.Provider value={{ setActions: setSlotActions, setLeftActions: setSlotLeftActions }}>
      <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 py-4">
        <div className="flex min-h-0 flex-1 flex-col gap-2 divide-y">
          <header className="flex shrink-0 items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              {headerLeftActions && <div>{headerLeftActions}</div>}
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
                <p className="text-muted-foreground text-sm">{description}</p>
              </div>
            </div>
            {headerActions && <div className="flex items-center gap-2 justify-end">{headerActions}</div>}
          </header>
          <div className="flex min-h-0 flex-1 flex-col pt-2">
            <ErrorBoundary fallbackRender={({ error }) => <ErrorFallback error={error as Error} />}>
              <Suspense fallback={<LoadingFallback />}>
                {children}
              </Suspense>
            </ErrorBoundary>
          </div>
        </div>
      </div>
    </PageActionsContext.Provider>
  );
}
const usePage = () => {
  const context = useContext(PageActionsContext);
  if (!context) {
    throw new Error("PageActions must be used within Page");
  }
  return context;
}
/** Renders actions in the page header while keeping definition in `content.tsx`. */
export function PageActions({ children }: { children: React.ReactNode }) {
  const { setActions } = usePage();

  useLayoutEffect(() => {
    setActions(children);
    return () => setActions(null);
  });

  return null;
}


/** Renders left actions in the page header while keeping definition in `content.tsx`. */
export function PageLeftActions({ children }: { children: React.ReactNode }) {
  const { setLeftActions } = usePage();

  useLayoutEffect(() => {
    setLeftActions(children);
    return () => setLeftActions(null);
  });

  return null;
}

