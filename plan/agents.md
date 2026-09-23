# Agents

Plan for **agents**: an agent receives a task from a user and runs a loop
(LLM → tools → LLM → …) until the task is done or it reaches `max_turns`.
Progress (LLM picked, text deltas, tool calls, tool results) is streamed while
it runs and kept for later.

Covers **Agent**, **Agent LLMs**, **Tool access**, **Run**, **Run events**,
**Loop**, **Execution & delivery**, **API**.

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

## Run

Table `agent_runs`. One execution of an agent for one input.

- **id** — uuid
- **agent_id** — FK `agents`, on delete cascade
- **user_id** — nullable FK `users`; null = started with an API key
- **status** — see below
- **input** — the task text
- **output** — final assistant text
- **error** — set when `failed`
- **turns** — turns used
- **input_tokens / output_tokens** — summed over turns
- **started_at / finished_at / created_at**

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

## Run events

Table `agent_run_events`. Everything that happened in a run, in order.

- **id** — bigserial; also the SSE event id
- **run_id** — FK `agent_runs`, on delete cascade
- **type**
- **data** — jsonb
- **created_at**

Index `(run_id, id)`.

| type               | data                                        | persisted |
|--------------------|---------------------------------------------|-----------|
| run_started        | agent_id, input                             | yes       |
| turn_started       | turn                                        | yes       |
| llm_started        | llm                                         | yes       |
| llm_skipped        | llm, error                                  | yes       |
| text_delta         | text                                        | **no**    |
| message            | full `llm.Message` (assistant or tool)      | yes       |
| tool_call_started  | call_id, name, tool_id, arguments           | yes       |
| tool_call_finished | call_id, content, is_error, duration_ms     | yes       |
| turn_finished      | turn, usage                                 | yes       |
| run_finished       | status, output, error, turns, usage         | yes       |

**Notes**

- `text_delta` is live only. It would be one row per token; the complete text
  arrives in the next `message` event anyway.
- `message` events are the source of truth for the conversation: history,
  replay and future follow-ups rebuild the message list from them.
- Event types mirror the stream events in `internal/llm/stream.go`
  (`LLMStartEvent`, `LLMSkippedEvent`, `TextDeltaEvent`, `MessageEvent`).

---

## Loop

#### `Run(run) → error`

```
targets    = agent llms sorted by order → []llm.Target
tools, idx = ResolveTools(agent)
msgs       = [system(system_prompt), user(input)]

emit run_started
for turn in 1..max_turns:
  emit turn_started
  it = runner.Stream(targets, msgs, tools)        // failover inside
  forward llm_started / llm_skipped / text_delta
  assistant = MessageEvent.Message
  append assistant to msgs; emit message

  calls = tool_call parts of assistant
  if no calls:
    status = completed; output = text of assistant
    break

  for call in calls:                              // sequential
    emit tool_call_started
    res = executor.Execute(idx[call.name], call.arguments)
    emit tool_call_finished
    append tool message(ToolResultPart{call.id, res.content, res.is_error})
    emit message
  emit turn_finished

if no break: status = max_turns
emit run_finished
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
  `MessageEvent` so the loop can fill `turn_finished` and the run totals.

---

## Execution & delivery

Starting a run and watching it are two separate endpoints. Every run is its
own goroutine, the same way `net/http` serves each request in its own
goroutine. There is no worker pool and no concurrency cap.

A run spends almost all of its time waiting on I/O (the LLM stream, MCP
calls). A waiting goroutine costs a few KB, so thousands of parallel runs
are fine. The real limits are outside the process, see **Limits** below.

- **Start** — `POST /agent/{id}/run` creates the run as `running`, starts
  `go loop.Run(runCtx, run)` and returns the run right away (`202`).
  - `runCtx` comes from the app's root context (`signal.NotifyContext` in
    `internal/bootstrap/bootstrap.go`), not from the request. The run keeps
    going after the POST returns or the client disconnects.
  - The run is registered in the in-memory hub:
    `runID → {cancel, subscribers}`.
- **Emit** — each event is written to `agent_run_events` (except
  `text_delta`), then published to that run's subscribers in the hub.
  A slow subscriber never blocks the run: it has a buffered channel, and if
  the buffer is full the event is dropped for that subscriber only. That
  subscriber catches up from the DB on its next reconnect.
- **Subscribe** — `GET /agent-run/{id}/events` (SSE, `api.NewSSEWriter`,
  `internal/api/sse.go`):
  1. Subscribe to the hub first, so no event is missed.
  2. Send stored events with `id > Last-Event-ID`.
  3. Stream live events, skipping ids already sent, and close after
     `run_finished`.

  Any number of clients can watch the same run. Reconnects resume without
  gaps. A finished run replays from the DB and closes.
- **Cancel** — `POST /agent-run/{id}/cancel` calls the hub's `cancel`.
  Cancelling a finished run is a no-op.
- **Shutdown** — the root context is cancelled, so every run stops as
  `cancelled` (error `"server shutdown"`). Bootstrap waits on a
  `sync.WaitGroup` of live runs, with a timeout, so the final events get
  written.
- **Boot** — runs still `running` in the DB (crash, `kill -9`) are marked
  `failed` with error `"interrupted"`.

**Limits**

Goroutines are not the bottleneck. These are:

- **LLM provider rate limits** — already handled: `ErrRateLimit` fails over
  to the next LLM in `order`.
- **stdio MCP servers** — every tool call starts a process
  (`internal/mcp/client.go` opens a session per call). Many parallel runs
  means many processes.
- **DB connections** — one short insert per event, so the GORM pool is
  shared fine.
- **Memory** — each run keeps its message list in memory until it ends.

If one of these starts to hurt, add an optional semaphore
(`cfg.Agent.MaxConcurrent`, `0` = unlimited) around `go loop.Run`. Don't
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

- `POST /agent/{id}/run` `{input}` → `202` + run, returns immediately. Disabled agent → 400.
- `GET /agent-run?agent_id=` — list runs.
- `GET /agent-run/{id}` — run.
- `GET /agent-run/{id}/events` — SSE, honors `Last-Event-ID`.
- `POST /agent-run/{id}/cancel`

**Visibility**

- A user sees only runs with their `user_id`.
- Admins and API keys see all runs.
- Regular users run agents without direct tool access: the agent's grants are
  the permission boundary, set by an admin.

---

## Code layout

Follows the existing layering (see `create-backend-module` / `create-web-feature`).

- **Models** — `internal/model/agent.go`, `agent-run.go` (Agent, AgentLLM,
  AgentMcpServer, AgentRun, AgentRunEvent).
- **Repositories** — `internal/repository/agent.go`, `agent-run.go`.
- **Modules**
  - `internal/module/agent/` — dto, service (CRUD, `ResolveTools`), handler.
  - `internal/module/agent-run/` — dto, service, handler, `loop.go`, `hub.go` (live runs: cancel, subscribers).
- **Migrations** — `make db-generate add_agents`, then `make db-hash`.
- **Wiring** — `internal/bootstrap/bootstrap.go`.
- **Shared** — extract `resolveTargets` from the llm-connection service.
- **Frontend** — `web/src/features/agent/`
  - Agent form: ordered LLM list, server grants with allow/deny patterns,
    tools preview.
  - Run view: event timeline (turns, tool calls with args/result, streamed
    text) via `httpSse` (`web/src/lib/http/sse.ts`).

---

## Later

Out of scope for the first version:

- LLM-chosen model routing (`llm_strategy`)
- `search_tools` meta-tool for huge tool sets
- Parallel tool calls in one turn
- Context compaction when the conversation grows
- Human approval before a tool runs (`ask` permission)
- Follow-up messages / multi-turn sessions (`parent_run_id`)
- Subagents (an agent exposed as a tool of another)
- Per-run cost
