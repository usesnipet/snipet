# Message

- Role - role of the message (user, assistant, system, tool)
- Content - content of the message (initially only a string)

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
  - Stream (optional) - the method that runs to generate text with the llm (with stream)
    - messages - array of messages of the conversation
    - model - the model of the provider that should be used
    - extra_options - extra options for the provider
    - auth_options - auth options for the provider

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
  Connect to the llm.
  Check if the model exists.
- Generate - run the generate method of an llm with failover
  Call Validate.
  Try to run generate.
  If generate errors, try the next llm; if there is no next, return an error.
  - llms - list of llms to run
    - model (provider-key/model)
    - extra_options - extra options for the provider
    - auth_options - auth options for the provider
  - messages - array of messages of the conversation
- Stream - run the stream method of an llm with failover
  Call Validate.
  Try to run stream.
  If stream errors, try the next llm; if there is no next, return an error.
  - llms - list of llms to run
    - model (provider-key/model)
    - extra_options - extra options for the provider
    - auth_options - auth options for the provider
  - messages - array of messages of the conversation
