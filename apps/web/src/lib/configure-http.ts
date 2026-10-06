import { authService, configureHttp } from "@snipet/client";

import { useAuthStore } from "@/features/auth/store";
import { ROUTES } from "@/routes";

import type { AuthResponse } from "@snipet/shared";

// handleUnauthorized clears an expired/revoked session and bounces to
// /login, preserving the current path to return to after signing back in.
// A 401 on a request made with no access token (e.g. a bad login attempt)
// isn't a session expiry, so it's left for the caller to handle instead.
function handleUnauthorized() {
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
