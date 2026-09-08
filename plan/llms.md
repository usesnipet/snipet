# Provider
- Info
  - key - unique identifier (clade, gpt, gemini)
  - name - Name of provider (Claude, GPT, Gemini)
  - description
  - tags - list of string to search the provider

- Auth (is a array, the provider can use many type of auth)
  - Type - Determine the type of authentication (no-auth, static (json-schema))
  - data (optional) - Data to configure the autentication (if static is the json schema)

- Schemas
  - GenerateExtraOptions - JSON Schema of Generate method
  - StreamExtraOptions - JSON Schema of Stream method

- API (can have more methods later)
  - Generate - Generate is the method that run to generate text with llm (no stream)
    - messages - Array of messages of conversation
    - model - the model of provider that should be used
    - extra_options - extra options to provider
  - Stream - Stream is the method that run to generate text with llm (with stream)
    - messages - Array of messages of conversation
    - model - the model of provider that should be used
    - extra_options - extra options to provider


# Registry
The registry of llm providers
- Has - check if has a provider by key
  - key - key of provider
- HasModel - check if a provider have a model (can receive the provider key and the model, or a string with format "provider-key/model")
- List - List providers
- Connect - connect to a provider
  Connect to a provider and return it connection
  - key - key of provider
  -
