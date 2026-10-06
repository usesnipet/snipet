// Each app wires auth into the client once, at startup, via configureHttp.
export type HttpConfig = {
  /** Prefix for every request URL, e.g. "https://api.example.com". Defaults to same origin. */
  baseUrl?: string;
  getAccessToken?: () => string | null | undefined;
  /** Called on a 401. Resolve true to retry the request once with the new token. */
  refreshToken?: () => Promise<boolean>;
  /** Called when the retried request still gets a 401. */
  onUnauthorized?: () => void;
};

let config: HttpConfig = {};

export const configureHttp = (next: HttpConfig) => {
  config = next;
};

export const getHttpConfig = (): HttpConfig => config;
