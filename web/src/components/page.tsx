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
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-8 py-8 lg:px-10">
        <header className="flex w-full max-w-6xl mx-auto shrink-0 items-start justify-between gap-4 pb-8">
          <div className="flex items-start gap-3">
            {headerLeftActions && <div>{headerLeftActions}</div>}
            <div className="space-y-1.5">
              <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
              <p className="text-muted-foreground max-w-xl text-sm text-pretty">{description}</p>
            </div>
          </div>
          {headerActions && <div className="flex shrink-0 items-center gap-2">{headerActions}</div>}
        </header>
        <div className="flex w-full max-w-6xl mx-auto min-h-0 flex-1 flex-col">
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

