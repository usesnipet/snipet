# Agents

Plan for **agents**: an agent receives a task from a user and runs a loop
(LLM → tools → LLM → …) until the task is done or it reaches `max_turns`.
Progress (LLM picked, text deltas, tool calls, tool results) is streamed while
it runs and kept for later.

Covers **Agent**, **Agent LLMs**, **Tool access**, **Session**, **Run**,
**Messages**, **Live events**, **Loop**, **Execution & delivery**, **API**.

Notation: methods are written as `Name(params) → Return`. `ctx` is always the
first param and is omitted from prose.

---

## Inspiration

How existing coding agents do it, and what we take.

- **Claude Code**
  - One single-threaded loop: call the model, run every `tool_use` it asked
    for, append the `tool_result`s, repeat until the model answers with no
    tool calls or `max_turns` is hit.
  - Permissions are allow/deny rules over tool names with wildcards
    (`mcp__github__*`, `mcp__github__delete_*`). Deny wins.
  - `stream-json` output: `system/init`, `assistant` messages, `user`
    messages carrying `tool_result`, and a final `result` with `num_turns`,
    usage and the stop reason.
  - Huge tool sets are deferred behind a search tool (ToolSearch) that loads
    schemas on demand.
- **opencode**
  - Session → messages → typed parts. A tool part has a state
    `pending → running → completed | error`; `step-start` / `step-finish`
    parts wrap each turn.
  - Every change is published on an event bus and pushed to clients over SSE.
  - Agent config has a `tools` map with globs (`"github_*": false`), a
    `permission` map (`allow | ask | deny`) and a `steps` max.
- **pi (pi-mono agent)**
  - Minimal loop with fine-grained events: `agent_start`, `turn_start`,
    `message_start/update/end`, `tool_execution_start/update/end`,
    `turn_end`, `agent_end`.
  - Steering / follow-up message queues let the user talk to a running agent.

**Takeaways**

- A plain loop is enough; no planner, no graph.
- One event stream feeds both the live UI and the stored history.
- Tool access by glob rules, not per-tool assignment.
- Tool calls have a lifecycle (`started` → `finished`) visible to the client.

---

## Agent

Table `agents`. Created and edited by admins only.

- **id** — uuid
- **name** — unique
- **description** — what the agent is for
- **system_prompt** — first message of every run
- **max_turns** — loop limit, default `20`
- **enabled** — a disabled agent cannot be run
- **created_at / updated_at**

---

## Agent LLMs

Table `agent_llms`. The ordered list of LLMs the agent may use.

- **agent_id** — FK `agents`, on delete cascade
- **order** — int; unique `(agent_id, order)`
- **model** — `"provider/model"`
- **llm_connection_id** — nullable FK `llm_connections`; null = provider's
  default connection
- **extra_options** — jsonb, passed to the provider

**Rules**

- Loaded sorted by `order` and turned into `[]llm.Target` with the same logic
  as `resolveTargets` in `internal/module/llm-connection/service.go`
  (extracted to a shared helper).
- The list goes straight to `llm.Runner.Stream` (`internal/llm/runner.go`),
  which already fails over in order. No new selection logic.
- Future: a `llm_strategy` field (`order` now; later the LLM or a router
  picks the model).

---

## Tool access

Tools are not assigned one by one (there will be thousands). An agent is
granted whole MCP servers, optionally narrowed by glob patterns.

Table `agent_mcp_servers`:

- **agent_id** — FK `agents`, on delete cascade
- **mcp_server_id** — FK `mcp_servers`, on delete cascade
- **allow** — jsonb `[]string`, glob patterns on tool name; empty = all
- **deny** — jsonb `[]string`, glob patterns on tool name

PK `(agent_id, mcp_server_id)`.

**Rules**

- A tool is allowed when its server is granted **and** (`allow` is empty
  **or** its name matches an `allow` pattern) **and** its name matches no
  `deny` pattern. Deny wins.
- Patterns use `path.Match` on the tool's own name (`list_*`, `*_delete`).
- Tools synced later into a granted server are picked up automatically.

**Examples**

| server | allow         | deny         | result                           |
|--------|---------------|--------------|----------------------------------|
| github | `[]`          | `[]`         | every github tool                |
| github | `["list_*"]`  | `[]`         | only `list_*` tools              |
| github | `[]`          | `["*delete*"]` | everything except deletes     |

#### `ResolveTools(agent) → ([]llm.Tool, map[string]string)`

Returns the tools sent to the LLM and a map from LLM tool name to tool ID.

- Each `model.Tool` becomes `llm.Tool{Name, Description, Parameters: InputSchema}`.
- **LLM tool name** = `<server>__<tool>`, sanitized to `[a-zA-Z0-9_-]` and cut
  to 64 chars. Avoids collisions between servers with tools of the same name.
- All allowed tools are sent every turn.
  *Ceiling:* context size with big tool sets. *Upgrade:* a `search_tools`
  meta-tool that loads schemas on demand (Claude Code's ToolSearch).

---

## Session

Table `agent_sessions`. A conversation with one agent. Every run belongs to a
session. A one-off task is just a session with a single run, so there is
only one code path.

- **id** — uuid
- **agent_id** — FK `agents`, on delete cascade
- **user_id** — nullable FK `users`; set when a snipet user started it
- **subject** — nullable string; set when an API key started it. Opaque id
  from the caller's system saying on whose behalf the session runs (a user,
  customer, tenant, device…), like the JWT `sub` claim
- **title** — nullable; first input, cut to 80 chars
- **created_at / updated_at**

Index `(agent_id, subject)`.

**Rules**

- Exactly one of `user_id` / `subject` is set, fixed when the
  session is created.
- **History** — the session's rows in `agent_messages`, ordered by `id`.
- **One run at a time** — starting a run while another run in the session is
  `running` returns `409`. Two loops writing to the same history would
  interleave.
- **Failed / cancelled runs** stay in the history up to their last `message`.
  An assistant message whose tool calls never got results is dropped when the
  history is loaded, because providers reject unanswered tool calls.
- *ponytail: the whole history is sent every run. Long sessions will hit the
  context limit; compaction is in **Later**.*

**Subject**

- API keys have no owner (`internal/model/api-key.go`), so the key identifies
  a trusted backend, not a person. That backend passes `subject` and
  snipet only uses it to scope sessions. Snipet never verifies it.
- The API key must stay server-side. A key shipped to a browser lets anyone
  read any subject's sessions.

---

## Run

Table `agent_runs`. One user message and the loop that answers it. It only
holds the loop's state; the content lives in `agent_messages`.

- **id** — uuid
- **session_id** — FK `agent_sessions`, on delete cascade
- **status** — see below
- **error** — set when `failed`
- **turns** — turns used
- **input_tokens / output_tokens** — summed from the run's assistant messages
- **started_at / finished_at / created_at**

The run's input is its `user` message; its output is its last `assistant`
message.

**Status**

```
running → completed | failed | cancelled | max_turns
```

- **completed** — the LLM answered with no tool calls
- **max_turns** — the loop hit `max_turns` first
- **failed** — fatal LLM error, every target failed, or the server restarted
  mid-run
- **cancelled** — cancelled by the user

---

## Messages

Table `agent_messages`. The conversation of a session, one row per
`llm.Message` (see **Message** in `plan/llms.md`). This is the source of
truth for history, the chat UI and SSE replay.

- **id** — bigserial; gives the order and is the SSE event id
- **session_id** — FK `agent_sessions`, on delete cascade
- **run_id** — FK `agent_runs`, on delete cascade
- **role** — `user` | `assistant` | `tool`
- **parts** — jsonb, the message's parts as in `llm.Message` (`text`,
  `image`, `tool_call`, `tool_result`)
- **model** — assistant only: the `"provider/model"` that answered
- **input_tokens / output_tokens** — assistant only
- **tool_id** — tool only: nullable FK `tools`, on delete set null
- **duration_ms** — tool only: how long the call took
- **created_at**

Index `(session_id, id)`, index `tool_id`.

**Rules**

- A `user` message is saved by the `POST` before the loop starts.
- An `assistant` message is saved once the stream ends (`MessageEvent`). Its
  `tool_call` parts are the tool calls the LLM asked for.
- Each tool call gets its own `tool` message with one `tool_result` part.
  `tool_id` and `duration_ms` sit in columns so "which tools were called,
  how often, how slow" is a plain SQL query. The call's arguments are in the
  matching `tool_call` part.
- A `tool_call` with no matching `tool` message yet means the tool is still
  running. On reconnect the client can show it as pending without any extra
  state.
- The system prompt is not stored. It comes from the agent on every run, so
  editing the agent affects later runs of existing sessions.
- `id` only has to increase within a session, not globally. Only one run is
  active per session and a single goroutine writes its messages in sequence,
  so ids commit in order there. Gaps from rolled-back inserts don't matter.
- *ponytail: parts are jsonb, not a `parts` table. Add a table only if you
  need to query inside parts beyond `tool_id`.*

---

## Live events

Sent over SSE only, never stored. Everything that matters for history is
already in `agent_messages` and `agent_runs`.

| event             | data                                  | SSE id     |
|-------------------|---------------------------------------|------------|
| run_started       | run                                   | —          |
| turn_started      | turn                                  | —          |
| llm_started       | llm                                   | —          |
| llm_skipped       | llm, error                            | —          |
| text_delta        | text                                  | —          |
| tool_call_started | call_id, name, tool_id                | —          |
| message           | the saved `agent_messages` row        | message id |
| run_finished      | run (status, error, turns, usage)     | —          |

**Notes**

- Only `message` events carry an SSE `id:`. The others are sent with no `id:`
  line, and per the SSE spec the client keeps the last id it saw. So
  `Last-Event-ID` is always the latest message id, and it only goes up
  within a session.
- `llm_skipped` is not stored. Failover reasons also go to the log.
- Event names mirror the stream events in `internal/llm/stream.go`
  (`LLMStartEvent`, `LLMSkippedEvent`, `TextDeltaEvent`, `MessageEvent`).

---

## Loop

#### `Run(run) → error`

```
targets    = agent llms sorted by order → []llm.Target
tools, idx = ResolveTools(agent)
msgs       = [system(system_prompt)] + session messages   // user message already saved

publish run_started
for turn in 1..max_turns:
  publish turn_started
  it = runner.Stream(targets, msgs, tools)        // failover inside
  forward llm_started / llm_skipped / text_delta
  assistant = save(MessageEvent.Message, model, usage)
  append assistant to msgs; publish message

  calls = tool_call parts of assistant
  if no calls:
    status = completed
    break

  for call in calls:                              // sequential
    publish tool_call_started
    res = executor.Execute(idx[call.name], call.arguments)
    tool = save(tool message(ToolResultPart{call.id, res.content, res.is_error}),
                tool_id, duration_ms)
    append tool to msgs; publish message

if no break: status = max_turns
save run (status, turns, token totals); publish run_finished
```

**Rules**

- Tools run through `tool.Executor.Execute` (`internal/module/tool/executor.go`),
  which validates args against the schema and calls the MCP server.
- A tool failure, bad arguments or an unknown tool name becomes an
  `is_error` tool result sent back to the LLM. It never stops the run.
- A fatal LLM error, or every target failing over, sets `failed`.
- Cancelling the run's `ctx` sets `cancelled`.
- Tool calls in one turn run one after another. Parallel is future work.

**Prerequisite**

- `MessageEvent` has no usage today (only `Response` does). Add `Usage` to
  `MessageEvent` so the loop can fill the assistant message's token columns.

---

## Execution & delivery

Starting a run and watching it are two separate endpoints. Every run is its
own goroutine, the same way `net/http` serves each request in its own
goroutine. There is no worker pool and no concurrency cap.

A run spends almost all of its time waiting on I/O (the LLM stream, MCP
calls). A waiting goroutine costs a few KB, so thousands of parallel runs
are fine. The real limits are outside the process, see **Limits** below.

- **Start** — `POST /agent-run` creates the run as `running`, starts
  `go execute(runCtx, run)` and returns the run right away (`202`).
  - `runCtx` comes from the app's root context (`signal.NotifyContext` in
    `internal/bootstrap/bootstrap.go`), not from the request. The run keeps
    going after the POST returns or the client disconnects.
  - The run is registered in the in-memory hub:
    `runID → {cancel, subscribers}`.
- **Publish** — messages are saved to `agent_messages` first, then published
  to that run's subscribers in the hub. Other live events are only
  published.
  A slow subscriber never blocks the run: it has a buffered channel, and if
  the buffer is full the event is dropped for that subscriber only. That
  subscriber catches up from the DB on its next reconnect.
- **Subscribe** — `GET /agent-run/{id}/events` (SSE, `api.NewSSEWriter`,
  `internal/api/sse.go`):
  1. Subscribe to the hub first, so no event is missed.
  2. Send the run's messages with `id > Last-Event-ID`.
  3. Stream live events, skipping messages already sent, and close after
     `run_finished`. A finished run gets `run_finished` built from the run
     row.

  Any number of clients can watch the same run. Reconnects resume without
  gaps in messages; live-only events missed while disconnected are gone,
  which is fine because nothing in them is needed to rebuild the state.
- **Cancel** — `POST /agent-run/{id}/cancel` calls the hub's `cancel`.
  Cancelling a finished run is a no-op.
- **Shutdown** — the root context is cancelled, so every run stops as
  `cancelled` (error `"server shutdown"`). Bootstrap waits on a
  `sync.WaitGroup` of live runs, with a timeout, so the final run state
  gets written.
- **Boot** — runs still `running` in the DB (crash, `kill -9`) are marked
  `failed` with error `"interrupted"`.

**Limits**

Goroutines are not the bottleneck. These are:

- **LLM provider rate limits** — already handled: `ErrRateLimit` fails over
  to the next LLM in `order`.
- **stdio MCP servers** — every tool call starts a process
  (`internal/mcp/client.go` opens a session per call). Many parallel runs
  means many processes.
- **DB connections** — one short insert per message, so the GORM pool is
  shared fine.
- **Memory** — each run keeps its message list in memory until it ends.

If one of these starts to hurt, add an optional semaphore
(`cfg.Agent.MaxConcurrent`, `0` = unlimited) around `go execute`. Don't
add it before then.

---

## API

**Admin** — `authGate` + `requireRole(model.RoleAdmin)`, same as `/tool` and
`/mcp-server`.

- `GET /agent`, `GET /agent/{id}`, `POST /agent`, `PUT /agent/{id}`,
  `DELETE /agent/{id}`
  - Body carries `llms[]` and `mcp_servers[]`; on update both lists are
    replaced in one transaction.
- `GET /agent/{id}/tools` — preview of `ResolveTools` for the agent.

**Runners** — `api.Or(apiKeyGate, authGate)`, same as `/llm-connection/execute`.

- `POST /agent-run` `{agent_id, input, session_id?, subject?}` → `202` +
  run, returns immediately. (Not under `/agent`, which is admin-only.)
  - No `session_id` creates a new session.
  - With a `session_id`, the session must belong to the caller and to this
    agent.
  - Disabled agent → `400`. A run already `running` in the session → `409`.
- `GET /agent-session?agent_id=&subject=` — list sessions.
- `GET /agent-session/{id}` — session.
- `GET /agent-session/{id}/messages?before=` — rows of `agent_messages`,
  newest first, paginated by id.
- `DELETE /agent-session/{id}` — `409` while a run is running.
- `GET /agent-run?session_id=` — runs of a session.
- `GET /agent-run/{id}` — run.
- `GET /agent-run/{id}/events` — SSE, honors `Last-Event-ID`.
- `POST /agent-run/{id}/cancel`

**Visibility** — decided on the session; a run inherits it from its session.

- A snipet user sees only sessions with their `user_id`. `subject`
  is ignored for them.
- An API key must send `subject` when it creates a session, and sees
  the sessions matching the `subject` it sends. It can list them
  all by leaving the filter empty.
- Admins see everything.
- Regular users run agents without direct tool access: the agent's grants are
  the permission boundary, set by an admin.

---

## Code layout

Follows the existing layering (see `create-backend-module` / `create-web-feature`).

- **Models** — `internal/model/agent.go`, `agent-run.go` (Agent, AgentLLM,
  AgentMcpServer, AgentSession, AgentRun, AgentMessage).
- **Repositories** — `internal/repository/agent.go`, `agent-run.go`.
- **Modules**
  - `internal/module/agent/` — dto, service (CRUD, `ResolveTools`), handler.
  - `internal/module/agent-run/` — dto, service, handler (sessions and runs),
    `loop.go`, `hub.go` (live runs: cancel, subscribers).
- **Migrations** — `make db-generate add_agents`, then `make db-hash`.
- **Wiring** — `internal/bootstrap/bootstrap.go`.
- **Shared** — extract `resolveTargets` from the llm-connection service.
- **Frontend** — `web/src/features/agent/`
  - Agent form: ordered LLM list, server grants with allow/deny patterns,
    tools preview.
  - Chat view: session list, and a thread rendered from `agent_messages`
    (text, tool calls paired with their results by `call_id`), live updates
    via `httpSse` (`web/src/lib/http/sse.ts`).

---

## Later

Out of scope for the first version:

- LLM-chosen model routing (`llm_strategy`)
- `search_tools` meta-tool for huge tool sets
- Parallel tool calls in one turn
- Context compaction when the conversation grows
- Human approval before a tool runs (`ask` permission)
- Messages sent while a run is running (inbox)
- Subagents (an agent exposed as a tool of another)
- Per-run cost
