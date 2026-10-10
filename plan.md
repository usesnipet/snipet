# Snipet architecture proposal (draft)

## Context
Early version: LLM = OpenAI + Ollama, tools = MCP servers + native tools, knowledge = S3 + pgvector RAG, channel = widget/API. Goal: pluggable, simple, extensible, customizable agent builder. Need a model that covers many LLM providers, many external apps (via API, MCP, other), built-in tools, dev-made tools, many knowledge sources + indexing strategies, and inbound channels — without Discord-as-connector vs Discord-as-channel duplication.

## Core idea: split by capability, not by app
One plugin per external app. A plugin declares capabilities; each capability is used by a different part of the system.

```
Plugin (code, registered at startup)          e.g. discord, github, google, web-search
 ├─ auth        none | apiKey | oauth2 (JSON schema, like LlmProviderInfo.auth)
 ├─ actions[]   tools the agent can call        (discord.send_message, github.create_issue)
 ├─ files       file storage for knowledge      (google drive, s3, onedrive) — storages only
 └─ triggers[]  inbound events that run agents  (discord.message, instagram.comment)

Connection (DB row)   plugin + encrypted credentials + config  = "my Discord bot", "my Google account"
```

Discord answer: a single `discord` plugin, a single Connection; agent A uses its actions as tools, a knowledge base uses its source, agent B is bound to its trigger as a moderator. No duplication.

## Concepts
| Concept | What | Today |
|---|---|---|
| Model provider | Driver for LLM/embedding APIs | `LlmProvider` + `LlmRegistry` + `llm-connection` |
| Plugin | Driver for an external app or capability | MCP servers + `NativeToolService` |
| Connection | Authenticated plugin instance | `mcp-server` rows, `llm-connection` rows |
| Tool | Any action exposed to an agent | `tool` table |
| Knowledge base | Sources + index strategy + embedding model | `knowledge` module |
| App | Third-party system calling the API (API key + app tokens) | `app` |
| Channel | Agent + Connection + plugin trigger | — |
| Agent | Prompt + model + tools + knowledge bases | `agent` |

## 1. Model providers
- Keep `LlmProvider` (`apps/api/src/infra/llm/provider.ts`) — already the right shape (info, models, generate/stream, healthCheck, JSON-schema auth/config).
- Add `embed?()` capability to the same interface; drop the separate `EmbeddingService` env config, embeddings pick a Connection like chat does.
- Providers to add: generic OpenAI-compatible (covers OpenRouter, Groq, DeepSeek, Together, vLLM, LM Studio, Azure-ish), Anthropic, Gemini, Bedrock. One file each under `infra/llm/providers/`.

## 2. Plugins (replaces "MCP servers" + "tools" as top-level concepts)
- Plugin interface: `info` (key, name, icon, auth methods, config schema), optional `actions(conn)`, `sources(conn)`, `triggers(conn)`, `healthCheck(conn)`.
- Transport is an implementation detail, not a concept:
  - Native code plugin (github via REST, calculator).
  - Generic `mcp` plugin: config = server URL/command; actions = MCP `listTools` (current `infra/mcp/connector.ts` moves here).
  - Generic `http`/OpenAPI plugin later: config = spec URL; actions generated from spec.
- Built-in tools (web search, calculator, search_knowledge) = plugins with `auth: none` and `builtin: true` — auto-attached to every agent, can be disabled per agent.
- Custom plugins, two flavors:
  - **Code plugin**: a dev writes a plugin in the repo (chart builder, job search aggregator). For logic that is more than one HTTP call.
  - **Declarative plugin**: created from the UI, no code. Import an OpenAPI spec (YAML/JSON or URL) or point to an MCP server. Each OpenAPI operation becomes an action (user selects which ones, big specs would flood the agent with tools); auth comes from the spec's `securitySchemes`. Under the hood it is a row backed by the generic `openapi` / `mcp` plugin, shown in the UI as its own plugin.
- Registry: same pattern as `LlmRegistry` (fixed at startup). Plugins live in-repo first: `packages/plugins/<key>` or `apps/api/src/plugins/<key>`. External npm/runtime loading later.
- OAuth2: one central callback route that any plugin with `oauth2` auth reuses; tokens encrypted with existing `ENCRYPTION_KEY`.
- Tool rows: `source = plugin key`, `connectionId`; sync on boot / interval like `mcp-server-sync.service.ts` today.

## 3. Knowledge
Rule: **knowledge = files, indexed ahead of time; live/streaming data = actions, queried at runtime.**
Chat history (Slack, Discord, email) is never indexed — the agent calls the app's own search through actions (`slack.search_messages`). No embedding cost, always fresh.

Pipeline: `Files -> Parser -> IndexStrategy -> search tool`.
- Files: plugin capability `files` (`list(cursor)` / `download(id)`), only for file storages: S3, Google Drive, OneDrive, Dropbox, local upload (built-in). Lives on the plugin so a Google connection gives both Gmail actions and Drive files with one login.
- Parser per media type: PDF/docs (current `@xberg-io/xberg`), audio/video (transcription), images (OCR/caption).
- Parser: file -> text (current `@xberg-io/xberg` usage).
- IndexStrategy interface: `index(doc)`, `remove(docId)`, `search(query, opts)`. Implementations: `rag` (current pgvector hybrid), `graph-rag`, `llm-wiki` (Karpathy-style LLM-maintained notes).
- Knowledge base = sources + strategy + strategy config (JSON schema) + embedding connection. Each base attached to an agent becomes one `search_<base>` tool.

## 4. Apps and channels
Two separate inbound concepts:
- **App**: a third-party system calling the Snipet API (customer backend, widget, mobile app). Keeps the current model: `App` (name, allowedOrigins) + `ApiKey.appId` + backend-minted app token JWT (`sub` = externalUserId).
- **Channel**: Snipet listening to a platform through a plugin trigger (Discord, WhatsApp, Instagram).

### Apps
- Add `allowedAgentIds` to `App`: app tokens and the app's API keys can only run/read sessions of those agents. Today any `agentId` sent by the client is accepted.
- Widget and REST API flow unchanged.

### Channels
- New `channels` table: `name`, `agentId`, `connectionId`, `trigger` (plugin trigger key), `config` jsonb (trigger filters, e.g. Discord channel ids).
- Session owner widens to exactly one of `userId | appId | channelId` (new column + update `CHK_agent_sessions_owner`). `externalUserId` is used with `appId` or `channelId`; for channels it means "conversation key" (WhatsApp number, Discord thread/channel id).
- Flow: plugin trigger receives event (webhook `/hooks/:channelId`, gateway socket, polling) -> normalizes `{ conversationKey, author, content, attachments, raw }` -> `ChannelDispatcher` finds-or-creates session (`channelId`, `externalUserId = conversationKey`) -> `AgentRunService` runs -> on finish calls `trigger.reply()` if the event supports it.
- Author goes into the user message metadata (a shared Discord channel has many authors, one session).
- Non-chat triggers (moderation, Instagram comments): agent acts through the same plugin's actions; config chooses session per conversation or one-shot session per event.

Steps: (1) `allowedAgentIds` on App; (2) `channels` table + session owner column; (3) `ChannelDispatcher` + trigger interface; (4) first channel (Discord or WhatsApp).

## Decisions
- Naming: **Plugin** (code driver for an app or built-in capability) + **Connection** (authenticated account of a plugin).
- Distribution: plugins live in-repo, registered at startup. npm/runtime loading deferred.
- One Connection exposes every capability of its plugin (actions, triggers, files).
- Knowledge only indexes files; chat/live data stays behind actions.
- Apps and Channels are separate concepts; name stays "App". Apps get an agent allowlist now.

## Suggested order
1. Generic plugin interface + registry; port MCP and native tools onto it (no behavior change).
2. Connections + central OAuth; first native plugin (GitHub or Google).
3. More LLM providers + `embed` capability.
4. Knowledge pipeline interfaces; port S3 + RAG; add Drive.
5. Agent allowlist on App; channels table + triggers; add Discord/WhatsApp.

## Deferred
- API key scopes (`agents:run`, `sessions:read`, ...).
- Publishable key for anonymous widget visitors (origin check + rate limit).
- Accepting the customer's own JWT via JWKS URL instead of minted app tokens.
- OAuth for third parties acting as a Snipet user.
Third-party plugin marketplace, sandboxed untrusted plugin code, per-tool human approval, multi-tenancy — add when needed.
