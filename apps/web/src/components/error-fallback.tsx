import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { ROUTES } from "@/routes";
import { Check, Copy, RefreshCw } from "lucide-react";
import { useState } from "react";
import { isRouteErrorResponse, useRouteError } from "react-router";

import { NotFound } from "./not-found";
import { StatusScreen } from "./status-screen";

type ErrorFallbackProps = {
  error: unknown;
  className?: string;
};

/**
 * A lazy route chunk that no longer exists on the server, which happens when
 * the app is redeployed while a tab is open. Reloading fetches the new build.
 */
function isStaleChunkError(error: unknown) {
  return (
    error instanceof Error &&
    /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
      error.message,
    )
  );
}

const reload = () => window.location.reload();

/** What to show when rendering fails: a reload prompt for a stale build, else the error and a way out. */
export function ErrorFallback({ error, className }: ErrorFallbackProps) {
  if (isStaleChunkError(error)) {
    return (
      <StatusScreen
        className={className}
        variant="updated"
        title="Snipet was updated"
        description="This tab is still on the previous version. Reload to get the latest one. Nothing you saved is lost."
        actions={
          <Button onClick={reload}>
            <RefreshCw />
            Reload page
          </Button>
        }
      />
    );
  }

  return (
    <StatusScreen
      className={className}
      variant="broken"
      title="This screen stopped working"
      description="Reloading usually fixes it. If it happens again, copy the details below and send them to whoever runs Snipet for you."
      actions={
        <>
          <Button onClick={reload}>
            <RefreshCw />
            Reload page
          </Button>
          <Button variant="outline" asChild>
            {/* The router link remounts the tree from the chat, leaving the broken state behind. */}
            <Link href={ROUTES.chat}>Go to chat</Link>
          </Button>
        </>
      }
    >
      <ErrorDetails error={error} />
    </StatusScreen>
  );
}

/** The error message up front, the stack folded away, and one click to copy both with the URL. */
function ErrorDetails({ error }: { error: unknown }) {
  const [isCopied, setIsCopied] = useState(false);
  const message =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : error
        ? String(error)
        : "No error message was reported.";
  const stack = error instanceof Error ? error.stack : undefined;

  const copyDetails = async () => {
    await navigator.clipboard.writeText([message, `URL: ${window.location.href}`, stack].filter(Boolean).join("\n\n"));
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="w-full min-w-0 rounded-lg border">
      <div className="flex items-start justify-between gap-3 p-3 pl-4">
        <p className="text-destructive min-w-0 pt-1.5 font-mono text-[13px] wrap-break-word">{message}</p>
        <Button variant="ghost" size="sm" className="shrink-0" onClick={copyDetails}>
          {isCopied ? <Check /> : <Copy />}
          {isCopied ? "Copied" : "Copy details"}
        </Button>
      </div>
      {stack && (
        <details className="border-t">
          <summary className="text-muted-foreground hover:text-foreground cursor-pointer px-4 py-2 text-xs select-none">
            Show stack trace
          </summary>
          <pre className="text-muted-foreground max-h-56 overflow-auto px-4 pb-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap wrap-break-word">
            {stack}
          </pre>
        </details>
      )}
    </div>
  );
}

/**
 * The router's `errorElement`: catches whatever a route throws, including a
 * lazy page that fails to load. Imported statically, since a lazy error page
 * would fail the same way the chunk it reports on did.
 */
export function RouteError({ className }: { className?: string }) {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFound className={className} />;
  return <ErrorFallback error={error} className={className} />;
}
