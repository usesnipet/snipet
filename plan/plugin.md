# Plugin
Plugins are a way to connect to external services and APIs. A plugin can have three capabilities:
- Actions: functions called by the user or the agent to perform a task in an external service or API (e.g. send an email, send a message, create a task).
- Triggers: events sent by external services or APIs that run something in the snipet (e.g. a new email is received, a new message is received).
- Storage: a bucket of files (s3, google drive, etc.). It can be indexed and searched by the user or the agent.

## Concepts
- **Manifest**: a JSON file that describes the plugin: metadata, auth, connection fields, and which driver each capability uses. No code.
- **Driver**: code that implements one capability for one protocol (`mcp`, `openapi`, `s3`, `webhook`, ...). Drivers are registered at startup, and each one exports a zod schema for its `options`.
- **Connection**: an authenticated instance of a plugin (DB row) = "my Google account". One connection exposes every capability of its plugin.

"Custom standards" are just drivers. `s3` covers AWS S3, MinIO, R2 and Wasabi through a configurable `endpoint`. There is no separate `s3-compatible` driver.

## Manifest structure
```json
{
  "key": "google-calendar",
  "name": "Google Calendar",
  "description": "Create and read calendar events",
  "icon": "google-calendar.svg",

  "auth": {
    "type": "oauth2",
    "authorizeUrl": "https://accounts.google.com/o/oauth2/v2/auth",
    "tokenUrl": "https://oauth2.googleapis.com/token",
    "scopes": ["https://www.googleapis.com/auth/calendar"],
    "authorizeParams": { "access_type": "offline", "prompt": "consent" }
  },

  "connection": {
    "calendarId": { "type": "string", "default": "primary" }
  },

  "actions": {
    "driver": "mcp",
    "options": {
      "url": "https://calendarmcp.googleapis.com/mcp",
      "headers": { "Authorization": "Bearer {{auth.accessToken}}" }
    }
  }
}
```

API key MCP with a webhook trigger authenticated differently:
```json
{
  "key": "acme",
  "name": "Acme",
  "auth": { "type": "none" },
  "connection": {
    "apiKey": { "type": "string", "secret": true },
    "webhookSecret": { "type": "string", "secret": true }
  },
  "actions": {
    "driver": "mcp",
    "options": { "url": "https://mcp.acme.com", "headers": { "X-Api-Key": "{{connection.apiKey}}" } }
  },
  "triggers": {
    "driver": "webhook",
    "options": { "verify": { "type": "hmac-sha256", "header": "X-Acme-Signature", "secret": "{{connection.webhookSecret}}" } }
  }
}
```

S3-compatible storage example:
```json
{
  "key": "minio",
  "name": "MinIO",
  "auth": { "type": "none" },
  "connection": {
    "endpoint": { "type": "string" },
    "bucket": { "type": "string" },
    "accessKeyId": { "type": "string" },
    "secretAccessKey": { "type": "string", "secret": true }
  },
  "storage": {
    "driver": "s3",
    "options": { "forcePathStyle": true, "endpoint": "{{connection.endpoint}}",
                 "accessKeyId": "{{connection.accessKeyId}}", "secretAccessKey": "{{connection.secretAccessKey}}" }
  }
}
```

## Fields
| Field | Filled by | Description |
|---|---|---|
| `key`, `name`, `description`, `icon` | plugin author | Metadata shown in the UI. `key` is unique. |
| `auth` | plugin author | Account login flow: `none` or `oauth2`. API keys and other static secrets are plain `secret` connection fields. |
| `connection` | user, once per connection | JSON-schema-like fields that the user fills when creating the connection. Fields with `secret: true` are encrypted (`ENCRYPTION_KEY`) and never returned by the API. |
| `actions` / `storage` / `triggers` | plugin author | `{ driver, options }`. `options` holds fixed values that are the same for every user. Each capability is optional. |

## Obtaining vs applying credentials
Drivers do not know auth types. Auth is split in two:
- **Obtaining**: `auth` (oauth2 flow, exposes `{{auth.accessToken}}`) or `connection` fields (`{{connection.x}}`, e.g. API keys).
- **Applying**: each capability's `options` places the values where its protocol expects them, through placeholders: `headers` for `mcp`/`openapi`, `env` for stdio `mcp`, keys for `s3`, `verify.secret` for `webhook`.

So the same `mcp` driver works with no auth, an API key or an oauth token, and actions and triggers of the same plugin can use different credentials. Placeholders are resolved right before each driver call (after any token refresh). Only `{{auth.*}}` and `{{connection.*}}` exist, with no expressions.

## Drivers
| Capability | Drivers |
|---|---|
| actions | `mcp` (server URL, tools from `listTools`), `openapi` (spec URL + selected `operations`), `native` (code module) |
| storage | `s3`, `google-drive`, `local` |
| triggers | `webhook` (signature verification + payload mapping), `polling`, `native` (gateway sockets, e.g. Discord) |

Triggers that reply use an action of the same plugin (`"reply": "send_message"`) instead of a fourth capability.

## OAuth2
- Static client: `clientId` + `clientSecret` come from the snipet config (env or admin), one per plugin, never from the manifest. The user only logs in with their account.
- Flow: authorization code + PKCE (S256) + client secret.
  1. `POST /connections/oauth/start { pluginKey }`: generate `state` + `code_verifier`, save them with a 10 min TTL (`oauth_states` table), and return the authorize URL.
  2. `GET /oauth/callback?code&state`: consume the state (single use), exchange the code at `tokenUrl`, and save `access_token`, `refresh_token`, `expires_at` encrypted on the connection.
  3. Before each driver call: refresh if the token is close to `expires_at`, with a per-connection lock (refresh tokens may rotate).
- One fixed `redirect_uri` for all plugins.
- Drivers never see the oauth flow, only the token placed by `options` (e.g. `"Authorization": "Bearer {{auth.accessToken}}"`).
- Note: Google requires an OAuth client from a Google Cloud project (consent screen; app verification for sensitive scopes like Calendar/Drive). Its MCP servers do not support dynamic client registration.

Deferred: dynamic client registration / MCP auth discovery, bring-your-own OAuth client per connection, multiple drivers per capability.
