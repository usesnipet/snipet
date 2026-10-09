# Tables
## plugin_connections
An authenticated instance of a plugin (see [plugin.md](plugin.md)).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK (`BaseEntity`) |
| `name` | varchar(255) | |
| `description` | text | default `''` |
| `pluginKey` | varchar(255) | Plugin manifest `key`. Indexed. |
| `config` | text | Connection field values as JSON, fully sealed with `ENCRYPTION_KEY` (`seal`/`open` from `@snipet/server-common`). |
| `enabled` | boolean | default `true` |
| `lastSyncedAt` | timestamptz | nullable. Last successful action sync (e.g. MCP `listTools`). |
| `lastSyncedError` | varchar(255) | nullable |
| `createdAt` / `updatedAt` | timestamptz | `BaseEntity` |

- `config` is decrypted only server side. The API returns it with the manifest's `secret` fields masked, and an update that keeps a masked value keeps the stored one.
- `config` is validated against the manifest's `connection` fields on create/update.
- `config` cannot be queried in SQL, which is fine because nothing filters by connection field values.


## agent_plugin_connections
A list of plugin connections that are used by an agent.
Unique constraint on `(agentId, pluginConnectionId)`.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK (`BaseEntity`) |
| `agentId` | uuid | FK to `agents.id`. |
| `pluginConnectionId` | uuid | FK to `plugin_connections.id`. |
| `allow` | text[] | Array of strings. Allowed actions. |
| `deny` | text[] | Array of strings. Denied actions. |
| `createdAt` / `updatedAt` | timestamptz | `BaseEntity` |

Allowed and denied actions are arrays of strings, representing the action names. Default is to allow all actions.

## plugin_actions
A list of actions that are available for a plugin connection.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK (`BaseEntity`) |
| `pluginConnectionId` | uuid | FK to `plugin_connections.id`. |
| `name` | varchar(255) | Action name. Indexed. |
| `description` | text | Action description. |
| `inputSchema` | jsonb | Action input schema. JSON-schema like. |
| `createdAt` / `updatedAt` | timestamptz | `BaseEntity` |