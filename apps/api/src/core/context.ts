/**
 * Who a session belongs to: the logged-in user, or an app, optionally on
 * behalf of one of its end users (the app token's, or the API key's pick).
 */
export type Owner =
  | { userId: string; appId: null; externalUserId: null; name: string | null }
  | { userId: null; appId: string; externalUserId: string | null; name: string | null };

/**
 * What the core needs from a request: who it acts for and its id for logs.
 */
export interface CoreContext {
  readonly owner: Owner;
  readonly requestId: string;
}
