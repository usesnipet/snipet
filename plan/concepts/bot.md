# Bot
It is an agent that answers user questions and inquiries in a personalized and contextualized way.
It can be trained to answer questions and inquiries more accurately and with better context.

It is an agent that has access to per-user conversation memory, bot context memory, and a knowledge source.

## Configuration
It is a configuration object that contains the following properties:
- LLMs: array of LLM configurations
- LLM:
  - Model: string
  - Provider: string
  - Configuration: jsonb - configuration to connect to the LLM