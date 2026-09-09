# LLM

Plan for the refactored llm layer: **Message**, **Errors**, **Provider**,
**Registry**, **Runner**.

Notation: methods are written as `Name(params) → Return`. `ctx` is always the
first param and is omitted from prose.

---

## Message

- **role** — role of the message (`user`, `assistant`, `system`, `tool`)
- **parts** — ordered list of parts that make up the message content

### Parts

A **part** is one typed piece of a message. A message holds an ordered list of
them, so a single message can mix text with an image or with tool activity.
Each part has a `type` plus the fields that type needs; a consumer
type-switches on `type`. This mirrors the stream events in
`internal/llm/stream.go` (a stream yields the same kinds of pieces
incrementally).

| type        | where     | fields                          |
|-------------|-----------|---------------------------------|
| text        | any role  | text                            |
| image       | user      | source (url/base64), mime_type  |
| tool_call   | assistant | id, name, arguments (JSON)      |
| tool_result | role tool | tool_call_id, content (string), is_error |

- **`text`** — a run of plain text
  - **text** — the string
- **`image`** — an image input
  - **source** — url or base64 data
  - **mime_type** — e.g. `image/png`, `image/jpeg`
- **`tool_call`** — the assistant asks to run a tool (assistant messages)
  - **id** — unique id for this call, referenced by the matching `tool_result`
  - **name** — tool name
  - **arguments** — JSON arguments for the tool
- **`tool_result`** — the result of a `tool_call` (tool messages)
  - **tool_call_id** — id of the `tool_call` this answers
  - **content** — the result payload, a string
  - **is_error** — `true` if the tool failed

**Notes**

- A plain text message is just one `text` part.
- Providers that only accept a string flatten the parts to their `text` parts
  joined together; non-text parts are dropped or rejected per provider.
- `role: tool` messages carry `tool_result` parts; `role: assistant` messages
  may carry `tool_call` parts.

---

## Errors

The provider returns predefined, typed errors. Each one has a fixed
classification the **Runner** uses to decide what to do:

- **failover** — give up on this llm and try the next one
- **fatal** — stop and return immediately

**Predefined errors**

- **`ErrRateLimit`** — failover
- **`ErrUnavailable`** — failover (provider down, upstream 5xx)
- **`ErrAuth`** — failover (auth invalid / rejected)
- **`ErrBadRequest`** — fatal (malformed messages or options)
- **`ErrModelNotFound`** — fatal
- **`ErrContextTooLong`** — fatal

**Rules**

- If the error is one of the predefined types, the Runner uses its
  classification.
- Any other / unknown error is **fatal** — a provider must opt in to failover
  by returning a predefined failover error.
- `context.Canceled` / `context.DeadlineExceeded` are always fatal — never
  fail over on them.

### FailoverError

When the Runner exhausts the llm list without success it returns a
**`FailoverError`** that aggregates every attempt.

- **errors** — ordered list of `{ llm, err }`, one per llm tried
- unwraps to the individual errors (`errors.Is` / `errors.As` reach each one)

---

## Model

One entry in a provider's catalog (`Models` returns `[]Model`).

- **id** — the string used in API calls (`gpt-4o`, `claude-sonnet-4`); this is
  what `HasModel` matches and what goes in `"provider-key/model"`
- **name** — display name
- **description**
- **capabilities** — a set of enum values, used to filter / route:
  - `text` — text output
  - `vision` — accepts image input
  - `tools` — supports tool / function calling
  - `streaming` — supports `Stream`
  - (later: `audio`, `json_mode`, `reasoning`)
- **context_window** — max input tokens (enables an `ErrContextTooLong`
  pre-check before hitting the network)
- **max_output_tokens** *(optional)* — cap on generated tokens

---

## Provider

### Data

- **Info**
  - **key** — unique identifier (`claude`, `gpt`, `gemini`)
  - **name** — display name (`Claude`, `GPT`, `Gemini`)
  - **description**
  - **tags** — list of strings to search the provider
- **Auth** — an array; the provider can offer many auth types
  - **type** — `no-auth` or `static` (json-schema)
  - **data** *(optional)* — config for the auth type (for `static`, the JSON schema)
- **Schemas**
  - **GenerateExtraOptions** *(optional)* — JSON Schema for `Generate`'s `extra_options`
  - **StreamExtraOptions** *(optional)* — JSON Schema for `Stream`'s `extra_options`

### Methods

More methods may be added later.

#### `Models(auth_options) → []Model`  *(required)*

Get the list of models this provider exposes.

- **Params**
  - **auth_options** — auth options for the provider

#### `HealthCheck(auth_options) → error`  *(optional)*

Check whether the provider is reachable right now.

- **Params**
  - **auth_options** — auth options for the provider

#### `Generate(messages, model, tools, extra_options, auth_options) → Response`  *(optional)*

Run the model once and return the full result (no stream).

- **Params**
  - **messages** — the conversation, an array of messages
  - **model** — the provider model to use
  - **tools** *(optional)* — tool definitions the model may call (`name`,
    `description`, `parameters` JSON Schema); the provider maps these to its
    own tool/function-calling format
  - **extra_options** — provider-specific options (validated against `GenerateExtraOptions`)
  - **auth_options** — auth options for the provider
- **Returns** — `Response`
  - **message** — the assistant `Message` (parts; may include `tool_call` parts)
  - **finish_reason** — `stop` | `length` | `tool_call`
  - **usage** — `input_tokens`, `output_tokens`

#### `Stream(messages, model, tools, extra_options, auth_options) → StreamIterator`  *(optional)*

Run the model and stream the result incrementally.

- **Params** — same as `Generate`
- **Returns** — a `StreamIterator` (see `internal/llm/stream.go`)

---

## Registry

The catalog of llm providers. Providers are defined in code and injected into
the registry on server start.

### Methods

#### `Has(key) → bool`

Check whether a provider exists by key.

- **Params**
  - **key** — provider key

#### `HasModel(..., auth_options) → bool`

Check whether a provider has a given model. Resolves the model list through
the same cache as `List` (see below).

- **Params**
  - the model, as either (`key`, `model`) or a single `"provider-key/model"` string
  - **auth_options** — auth options for the provider (needed to fetch `Models`)

#### `List() → []Provider`

List the registered providers.

#### `Connect(key, auth_options) → Provider`

Resolve a provider and hand back a ready-to-use handle.

- **Params**
  - **key** — provider key
  - **auth_options** — auth options for the provider
- **Behavior**
  1. Look up the provider by key.
  2. If it exists, run its `HealthCheck` (when available).
  3. Validate the `auth_options`.

### Models cache

- The registry keeps an **LRU cache** of `Models` results so repeated lookups
  (`List`, `HasModel`) don't hit the provider API every time.
- **Key:** `provider-key` + a hash of the `auth_options` — different
  credentials / tiers can expose different model lists.
- **Size:** configurable; entries evicted LRU. (TTL / explicit invalidation
  still open — see open questions.)
- **Single-flight:** concurrent misses for the same key collapse into one
  `Models` call; the rest wait for its result.

---

## Runner

Runs the llms on behalf of a caller, with failover across a list of llms.

Each `llm` entry in the lists below is:

- **model** — `"provider-key/model"`
- **extra_options** — provider-specific options
- **auth_options** — auth options for the provider

### Methods

#### `Validate(llm) → error`

Validate one llm before running it.

- **Behavior**
  1. Call `Registry.Connect` (connects, health-checks, validates `auth_options`).
  2. Call `Registry.HasModel` to confirm the model exists.
  3. Validate `extra_options` against the provider's `GenerateExtraOptions` /
     `StreamExtraOptions` schema; on failure return a **fatal** `ErrBadRequest`
     (no failover).

#### `Generate(llms, messages, tools) → Response`

Run `Generate` against the list of llms, failing over on error.

- **Params**
  - **llms** — ordered list of llms to try
  - **messages** — the conversation
  - **tools** *(optional)* — tool definitions, forwarded to the provider
- **Behavior**
  1. For each llm:
     a. If `ctx.Err() != nil`, stop and return it.
     b. Call `Validate`, then run `Generate`.
  2. On a **failover** error, move to the next llm.
  3. On a **fatal** error, return immediately.
  4. If every llm fails, return a `FailoverError` aggregating all attempts.

#### `Stream(llms, messages, tools) → StreamIterator`

Run `Stream` against the list of llms, failing over only before the stream starts.

- **Params**
  - **llms** — ordered list of llms to try
  - **messages** — the conversation
  - **tools** *(optional)* — tool definitions, forwarded to the provider
- **Behavior**
  1. For each llm:
     a. If `ctx.Err() != nil`, stop and return it.
     b. Call `Validate`, then run `Stream`.
  2. Failover happens **only before the first event is yielded**: a failover
     error before the first event moves to the next llm.
  3. Once the first event has been yielded, any error is propagated to the caller.
  4. A **fatal** error before the first event returns immediately.
  5. If every llm fails before its first event, return a `FailoverError`
     aggregating all attempts.
