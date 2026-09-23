# MCP servers and tools

How the backend talks to MCP servers and turns what they expose into rows
of the `tools` table that agents can execute.

```
internal/mcp/                  registry (built-in catalog), typed config, Connector
internal/tool/                 Source enum + Result (what an execution returns)
internal/module/mcp-server/    CRUD + SyncService + SyncWorker
internal/module/tool/          listing + Executor (POST /api/tool/{id}/execute)
```

## Config

`model.McpServer.Config` is stored as `jsonx.JSONMap`, but its shape is
fixed by `Transport` (`internal/mcp/config.go`):

- `http` → `HTTPConfig{url, headers, timeout}`
- `stdio` → `StdioConfig{command, args, timeout}`

`mcp.ValidateConfig` decodes strictly (unknown fields are rejected), and the
mcp-server service calls it on create/update. Registry entries use
`HTTPRegistryConfig`, whose `headers_schema` is a JSON Schema the web app
renders as the install form; the filled values land in `headers`.

## Connector

`mcp.IConnector` (`internal/mcp/client.go`) wraps the official Go SDK
(`github.com/modelcontextprotocol/go-sdk`, imported as `mcpsdk`). Each call
opens a session, does one operation (`ListTools`, `CallTool`) and closes
it. There's no connection pool. The config `timeout` (default 30s) covers
the whole operation. On `http`, the configured headers go on every request.
On `stdio`, the process is bound to that context, so it dies with it.

Tests: `client_test.go` runs a real MCP server over HTTP (`httptest`) and
over stdio (the test binary re-executes itself as the server).

## Sync

`SyncService.SyncServer(id)` lists the server's tools and calls
`IToolRepository.ReplaceServerTools`, which matches tools by name: it
updates the ones that exist, creates the new ones and deletes the ones that
are gone. It then records the outcome with
`IMcpServerRepository.UpdateSyncStatus`. When the server can't be reached,
only the error is recorded and the previous tools are kept.

`SyncWorker` runs syncs on the `queue.Pool`:

- every server at startup, then every `SYNC_INTERVAL` (default `5m`, `0` disables);
- one server on demand via `Enqueue(id)`, which the mcp-server service calls
  after a create, or after an update that changes transport/config;
- a server already queued or syncing isn't queued again.

## Execution

`tool.Executor.Execute(ctx, toolID, args)` loads the tool and validates
`args` against its `input_schema` (`pkg/json_schema`). It then calls the
tool on its server through the Connector. Anything the model could act on
(invalid arguments, an unreachable server, a tool-level error) comes back as
`tool.Result{IsError: true}`, which maps 1:1 to `llm.ToolResultPart`. The
`error` return is reserved for internal failures (tool not found, DB). Only
`mcp` tools are supported for now. `native` exists in `tool.Source` but has
no implementations.

Agents should execute by tool **ID**. The name shown to a model (e.g.
`<server>__<tool>`) is derived from the server and tool names when the
agent builds its tool list, so it isn't stored.
