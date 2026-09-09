# Message

- Role - role of the message (user, assistant, system, tool)
- Parts - ordered list of parts that make up the message content

## Parts

A part is one typed piece of a message. A message holds an ordered list of
them, so a single message can mix text with an image or with tool activity.
Each part has a `type` and the fields that type needs; a consumer
type-switches on `type`. This mirrors the stream events in
internal/llm/stream.go (a stream yields the same kinds of pieces
incrementally).

┌─────────────┬───────────────┬─────────────────────────────────┐
│    type     │     where     │             fields              │
├─────────────┼───────────────┼─────────────────────────────────┤
│ text        │ any role      │ text                            |
├─────────────┼───────────────┼─────────────────────────────────┤
│ image       │ user          │ source (url/base64), mime_type  │
├─────────────┼───────────────┼─────────────────────────────────┤
│ tool_call   │ assistant     │ id, name, arguments (JSON)      |
├─────────────┼───────────────┼─────────────────────────────────┤
│ tool_result │ role tool     │ tool_call_id, content, is_error |
└─────────────┴───────────────┴─────────────────────────────────┘

Part types:

- text - a run of plain text
  - text - the string
- image - an image input
  - source - url or base64 data
  - mime_type - e.g. image/png, image/jpeg
- tool_call - the assistant asks to run a tool (assistant messages)
  - id - unique id for this call, referenced by the matching tool_result
  - name - tool name
  - arguments - JSON arguments for the tool
- tool_result - the result of a tool_call (tool messages)
  - tool_call_id - id of the tool_call this answers
  - content - the result payload (parts or string)
  - is_error - true if the tool failed

Notes:

- A plain text message is just one `text` part.
- Providers that only accept a string flatten the parts to their `text`
  parts joined together; non-text parts are dropped or rejected per provider.
- `role: tool` messages carry `tool_result` parts; `role: assistant`
  messages may carry `tool_call` parts.

# Errors

The provider returns predefined, typed errors. Each predefined error has a
fixed classification the Runner uses to decide failover:

- ErrRateLimit - retryable
- ErrUnavailable - retryable (provider down, upstream 5xx)
- ErrAuth - retryable (auth invalid / rejected)
- ErrBadRequest - fatal (malformed messages or options)
- ErrModelNotFound - fatal
- ErrContextTooLong - fatal

Rule: if the error is one of the predefined types, the Runner uses its
classification. Any other / unknown error is treated as retryable.

# Provider

- Info
  - key - unique identifier (claude, gpt, gemini)
  - name - name of the provider (Claude, GPT, Gemini)
  - description
  - tags - list of strings to search the provider

- Auth (is an array; the provider can use many types of auth)
  - type - determines the type of authentication (no-auth, static (json-schema))
  - data (optional) - data to configure the authentication (if static, this is the json schema)

- Schemas
  - GenerateExtraOptions (optional) - JSON Schema of the Generate method
  - StreamExtraOptions (optional) - JSON Schema of the Stream method

- API (can have more methods later)
  - Models (required) - get the list of models that this provider has
    - ctx
    - auth_options - auth options for the provider
  - HealthCheck (optional) - check if the provider is available now
    - ctx
    - auth_options - auth options for the provider
  - Generate (optional) - the method that runs to generate text with the llm (no stream)
    - ctx
    - messages - array of messages of the conversation
    - model - the model of the provider that should be used
    - extra_options - extra options for the provider
    - auth_options - auth options for the provider
    - returns: a Response
      - message - the assistant Message (parts; may include tool_call parts)
      - finish_reason - stop | length | tool_call
      - usage - input_tokens, output_tokens
  - Stream (optional) - the method that runs to generate text with the llm (with stream)
    - ctx
    - messages - array of messages of the conversation
    - model - the model of the provider that should be used
    - extra_options - extra options for the provider
    - auth_options - auth options for the provider
    - returns: a StreamIterator (see internal/llm/stream.go)

# Registry

The registry of llm providers. The llm providers are defined in the code; on server start they are injected into the registry.

- Has - check if a provider exists by key
  - key - key of the provider
- HasModel - check if a provider has a model (can receive the provider key and the model, or a string with the format "provider-key/model")
- List - list providers
- Connect - connect to a provider and return it
  Get the provider by key; if it exists, run the health check (if available) and validate the auth options.
  - ctx
  - key - key of the provider
  - auth_options - auth options for the provider

Models cache:

- The registry keeps an LRU cache of Models results so repeated lookups
  (List, HasModel) don't hit the provider API every time.
- Cache size is configurable; entries are evicted LRU.

# Runner

Responsible for running the llms.

- Validate - validate provider and model
  Call Registry.Connect (connects, health-checks, validates auth options).
  Call Registry.HasModel to check the model exists.
  Validate extra_options against the provider's GenerateExtraOptions /
  StreamExtraOptions JSON Schema; on failure return a fatal ErrBadRequest
  (no failover).
- Generate - run the generate method of an llm with failover
  Call Validate.
  Try to run generate.
  If generate returns a retryable error, try the next llm.
  If generate returns a fatal error, return immediately.
  If every llm fails, return a list with all the errors.
  - llms - list of llms to run
    - model (provider-key/model)
    - extra_options - extra options for the provider
    - auth_options - auth options for the provider
  - messages - array of messages of the conversation
- Stream - run the stream method of an llm with failover
  Call Validate.
  Try to run stream.
  Failover only happens before the first event is yielded: if a retryable
  error occurs before the first event, try the next llm; once the first
  event has been yielded, any error is propagated to the caller.
  A fatal error before the first event returns immediately.
  If every llm fails before its first event, return a list with all the errors.
  - llms - list of llms to run
    - model (provider-key/model)
    - extra_options - extra options for the provider
    - auth_options - auth options for the provider
  - messages - array of messages of the conversation
