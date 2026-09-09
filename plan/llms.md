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
│    type     │     onde      │             campos              │
├─────────────┼───────────────┼─────────────────────────────────┤
│ text        │ qualquer role │ text                            |
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

Errors are typed so the Runner can decide whether to fail over.

- Retryable - the next llm should be tried (auth invalid, rate limit, provider unavailable, upstream 5xx)
- Fatal - stop and return immediately (invalid request, unknown provider/model, code bug)

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
    - auth_options - auth options for the provider
  - HealthCheck (optional) - check if the provider is available now
    - auth_options - auth options for the provider
  - Generate (optional) - the method that runs to generate text with the llm (no stream)
    - messages - array of messages of the conversation
    - model - the model of the provider that should be used
    - extra_options - extra options for the provider
    - auth_options - auth options for the provider
    - returns: the generated text
  - Stream (optional) - the method that runs to generate text with the llm (with stream)
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
  - key - key of the provider
  - auth_options - auth options for the provider

# Runner

Responsible for running the llms.

- Validate - validate provider and model
  Call Registry.Connect (connects, health-checks, validates auth options).
  Call Registry.HasModel to check the model exists.
- Generate - run the generate method of an llm with failover
  Call Validate.
  Try to run generate.
  If generate returns a Retryable error, try the next llm; if there is no next, return an error.
  If generate returns a Fatal error, return immediately.
  - llms - list of llms to run
    - model (provider-key/model)
    - extra_options - extra options for the provider
    - auth_options - auth options for the provider
  - messages - array of messages of the conversation
- Stream - run the stream method of an llm with failover
  Call Validate.
  Try to run stream.
  If stream returns a Retryable error, try the next llm; if there is no next, return an error.
  If stream returns a Fatal error, return immediately.
  - llms - list of llms to run
    - model (provider-key/model)
    - extra_options - extra options for the provider
    - auth_options - auth options for the provider
  - messages - array of messages of the conversation
