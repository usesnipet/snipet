# @snipet/hooks

Types and a request handler for [Snipet](https://github.com/usesnipet/snipet) plugin hooks served over HTTP.

A plugin whose `hooks` capability uses the `http` driver gets every event posted as JSON to its URL; the response body
is the handler's reply. This package validates the event, runs your function for its hook and answers with its result.

```sh
npm install @snipet/hooks zod
```

## Fetch-style servers (Hono, Next.js, Bun, Deno, Workers)

```ts
import { createHookHandler, HookAction } from "@snipet/hooks";

const handler = createHookHandler({
  "tool.before": (event) =>
    event.payload.call.name === "delete_account"
      ? { action: HookAction.DENY, reason: "Not allowed from chat" }
      : { action: HookAction.CONTINUE },
  "run.end": async (event) => {
    await saveUsage(event.agent.id, event.payload.usage);
    return { action: HookAction.CONTINUE };
  },
});

export const POST = handler; // Next.js route handler
```

## Servers that parse JSON (Express, Nest, Fastify)

```ts
import { handleHook, InvalidHookEventError } from "@snipet/hooks";

app.post("/hooks", async (req, res, next) => {
  try {
    res.json(await handleHook(handlers, req.body));
  } catch (error) {
    if (error instanceof InvalidHookEventError) res.status(400).json({ error: error.message });
    else next(error);
  }
});
```

## Behavior

- Each function gets the event typed for its hook and may reply with any action that hook accepts (`HookAction.CONTINUE`,
  `MODIFY`, `DENY`, `RESPOND`, `STOP`; the types only allow the ones the hook takes). `state` in a reply is merged into the plugin's state for the run.
- A hook without a function, or one newer than this package, is answered with `{ "action": "continue" }`.
- A body that is not a valid event gets a 400. A function that throws becomes a 500, which the runner handles per the
  handler's `onFailure`.
- `event.id` is unique per dispatch: use it as the idempotency key.

## Authentication

The `http` driver sends the headers set in the plugin's options with every request. Put a secret there (for example
`authorization: Bearer <token>`) and check it before calling the handler.
