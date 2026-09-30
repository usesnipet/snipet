import { authService } from "@/features/auth/service";
import { useAuthStore } from "@/features/auth/store";
import { ROUTES } from "@/routes";

import type { AuthResponse } from "@/features/auth/schemas";
import type { PathParamsRecord, SearchParamsRecord } from "./http";
export function applyPathParams(url: string, params: PathParamsRecord): string {
  return Object.entries(params).reduce(
    (result, [key, value]) =>
      result.replaceAll(`{${key}}`, encodeURIComponent(String(value))),
    url,
  );
}

export function buildSearchParams(params: SearchParamsRecord): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    searchParams.append(key, String(value));
  }

  return searchParams.toString();
}

export function applySearchParams(
  url: string,
  params: SearchParamsRecord,
): string {
  const query = buildSearchParams(params);
  if (!query) return url;

  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}${query}`;
}

// handleUnauthorized clears an expired/revoked session and bounces to
// /login, preserving the current path to return to after signing back in.
// A 401 on a request made with no access token (e.g. a bad login attempt)
// isn't a session expiry, so it's left for the caller to handle instead.
export function handleUnauthorized() {
  const { accessToken, clearSession } = useAuthStore.getState();
  if (!accessToken) return;

  clearSession();
  if (window.location.pathname === ROUTES.login) return;

  const redirect = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.assign(`${ROUTES.login}?redirect=${redirect}`);
}

let refreshTokenPromise: Promise<AuthResponse> | null = null;

// handleRefreshToken exchanges the stored refresh token for a new session.
// Concurrent callers share the same in-flight request. Returns whether the
// refresh succeeded; on failure it logs the user out.
export async function handleRefreshToken(): Promise<boolean> {
  const refreshToken = useAuthStore.getState().refreshToken;
  if (!refreshToken) {
    handleUnauthorized();
    return false;
  }

  try {
    if (!refreshTokenPromise) {
      refreshTokenPromise = authService.refresh({ refresh_token: refreshToken }, { retry: true });
    }
    const session = await refreshTokenPromise;
    useAuthStore.getState().setSession({
      accessToken: session.access_token,
      accessTokenExpiresAt: session.expires_at.toISOString(),
      refreshToken: session.refresh_token,
      user: session.user,
    });
    return true;
  } catch {
    handleUnauthorized();
    return false;
  } finally {
    refreshTokenPromise = null;
  }
}
