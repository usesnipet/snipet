import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { ROUTES } from "@/routes";
import { ArrowLeft } from "lucide-react";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";

import { StatusScreen } from "./status-screen";

/** "Page not found" for a URL no route matches, naming the path so a typo is easy to spot. */
export function NotFound({ className }: { className?: string }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  // The router keeps its own history index; 0 means this tab opened straight on the bad link.
  const canGoBack = (window.history.state as { idx?: number } | null)?.idx ? true : false;

  useEffect(() => {
    document.title = "Page not found · Snipet";
  }, []);

  return (
    <StatusScreen
      className={className}
      variant="missing"
      title="Page not found"
      description={
        <>
          <p>The link may be old, or the page was moved or removed. Nothing is at this address:</p>
          <p className="bg-muted text-foreground mt-3 w-fit max-w-full rounded-md px-2.5 py-1.5 font-mono text-[13px] break-all">
            {pathname}
          </p>
        </>
      }
      actions={
        <>
          <Button asChild>
            <Link href={ROUTES.chat}>Go to chat</Link>
          </Button>
          {canGoBack && (
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft />
              Go back
            </Button>
          )}
        </>
      }
    />
  );
}
