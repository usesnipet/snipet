import { ApiError, appService } from "@snipet/client";

/** The pair POST /apps/:id/anonymous-token returns, as kept in localStorage. */
type StoredTokens = { token: string; refreshToken: string };

const storageKey = (appId: string) => `@snipet/widget/anonymous:${appId}`;

// localStorage throws when site data is blocked; the identity then lasts only for this page.
function read(appId: string): StoredTokens | null {
  try {
    return JSON.parse(localStorage.getItem(storageKey(appId)) ?? "null");
  } catch {
    return null;
  }
}

function write(appId: string, tokens: StoredTokens) {
  try {
    localStorage.setItem(storageKey(appId), JSON.stringify(tokens));
  } catch {
    // See read().
  }
}

/**
 * A token for the app's anonymous end user, kept in localStorage so the same
 * user (and their chats) comes back on later visits. `renew` skips the stored
 * access token, e.g. after a 401.
 */
export async function anonymousToken(appId: string, renew = false): Promise<string> {
  const stored = read(appId);
  if (stored && !renew) return stored.token;

  let next;
  try {
    next = await appService.issueAnonymousToken(appId, { refreshToken: stored?.refreshToken });
  } catch (error) {
    // Only a rejected refresh token starts a new identity; a network error must not.
    if (!stored || !(ApiError.is(error) && error.statusCode === 401)) throw error;
    next = await appService.issueAnonymousToken(appId, {});
  }
  write(appId, { token: next.token, refreshToken: next.refreshToken });
  return next.token;
}
