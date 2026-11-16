import { toast } from "@/hooks/use-toast";
import { useEffect } from "react";
import { useSearchParams } from "react-router";

import { useAuthorizePluginConnection } from "@snipet/client";

import type { PluginAuthStatus } from "@snipet/shared";
import type { PluginManifest } from "@snipet/shared/core";

/** Whether connections of this plugin authorize through OAuth. */
export const usesOAuth = (plugin: PluginManifest) => plugin.auth.type === "oauth2";

/** Badge text for a status that needs the user's attention; undefined when there's nothing to say. */
export function authStatusLabel(status: PluginAuthStatus): string | undefined {
  if (status === "missing") return "Not connected";
  if (status === "expired") return "Expired";
  return undefined;
}

/**
 * Sends the browser to the plugin's consent page; the provider brings it back
 * to the current page, where `useOAuthReturn` reports the outcome. Reads
 * `window.location`, not the router's: dialogs render outside the <Router>.
 */
export function useConnectOAuth() {
  const { mutateAsync: authorize, isPending } = useAuthorizePluginConnection();
  const connect = async (connectionId: string) => {
    const returnTo = window.location.pathname + window.location.search;
    const { url } = await authorize({ id: connectionId, data: { returnTo } });
    window.location.assign(url);
  };
  return { connect, isPending };
}

/** Why the provider sent the user back without tokens, in words. */
function describeError(reason: string | null): string {
  if (reason === "access_denied") return "The authorization was cancelled.";
  if (reason === "invalid_state") return "The authorization link expired. Try again.";
  return reason ? `The provider answered ${reason}.` : "Something went wrong. Try again.";
}

/**
 * Reports the outcome of an OAuth round trip (`?oauth=success|error` added by
 * the API's callback), then drops those params from the URL so a reload
 * doesn't report it again. Returns the connection it was about.
 */
export function useOAuthReturn(onReturn?: (connectionId: string) => void) {
  const [searchParams, setSearchParams] = useSearchParams();
  const outcome = searchParams.get("oauth");
  const connectionId = searchParams.get("connectionId");
  const reason = searchParams.get("reason");

  useEffect(() => {
    if (!outcome) return;
    if (outcome === "success") toast({ title: "Plugin connection authorized" });
    else toast({ title: "Authorization failed", description: describeError(reason), variant: "destructive" });
    if (connectionId) onReturn?.(connectionId);
    setSearchParams(
      (params) => {
        for (const name of ["oauth", "connectionId", "reason"]) params.delete(name);
        return params;
      },
      { replace: true },
    );
    // Runs once per return: the params are gone after the first pass.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome]);
}
