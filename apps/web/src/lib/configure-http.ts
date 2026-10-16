import { authService, configureHttp } from "@snipet/client";

import { useAuthStore } from "@/features/auth/store";
import { ROUTES } from "@/routes";

import type { AuthResponse } from "@snipet/shared";

/**
 * Clears an expired or revoked session and redirects to /login, keeping the
 * current path to return to. A 401 without an access token (e.g. a bad login)
 * isn't a session expiry, so it's left to the caller.
 */
function handleUnauthorized() {
  const { accessToken, clearSession } = useAuthStore.getState();
  if (!accessToken) return;

  clearSession();
  if (window.location.pathname === ROUTES.login) return;

  const redirect = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.assign(`${ROUTES.login}?redirect=${redirect}`);
}

let refreshTokenPromise: Promise<AuthResponse> | null = null;

/**
 * Exchanges the stored refresh token for a new session; concurrent callers
 * share one in-flight request. Returns whether it worked, logging out if not.
 */
async function handleRefreshToken(): Promise<boolean> {
  const refreshToken = useAuthStore.getState().refreshToken;
  if (!refreshToken) {
    handleUnauthorized();
    return false;
  }

  try {
    if (!refreshTokenPromise) {
      refreshTokenPromise = authService.refresh({ refreshToken }, { retry: true });
    }
    const session = await refreshTokenPromise;
    useAuthStore.getState().setSession({
      accessToken: session.accessToken,
      accessTokenExpiresAt: session.expiresAt.toISOString(),
      refreshToken: session.refreshToken,
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

configureHttp({
  getAccessToken: () => useAuthStore.getState().accessToken,
  refreshToken: handleRefreshToken,
  onUnauthorized: handleUnauthorized,
});
