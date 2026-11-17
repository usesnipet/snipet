# @snipet/widget

The Snipet chat widget: a chat launcher and panel for your Snipet agents, on any website.
It renders inside a Shadow DOM, so your page's CSS and the widget's never touch.

Using React or Angular? Use [`@snipet/react-widget`](https://github.com/usesnipet/snipet/tree/main/packages/react-widget) or
[`@snipet/angular-widget`](https://github.com/usesnipet/snipet/tree/main/packages/angular-widget) instead.

## Install

### Script tag

```html
<script src="https://unpkg.com/@snipet/widget@x.y.z/dist/widget.js"></script>
<script>
  SnipetWidget.init({
    apiUrl: "https://snipet.example.com",
    appId: "<your app id>",
    agentId: "<your agent id>",
  });
</script>
```

Loading the script only defines `window.SnipetWidget`; nothing shows up until `init()`.
Use the version that matches your Snipet server (`x.y.z` widget for an `x.y.z` server).

### npm

```bash
npm install @snipet/widget
```

```ts
import { snipet } from "@snipet/widget";

snipet.init({ apiUrl: "https://snipet.example.com", appId: "...", agentId: "..." });
snipet.open();
```

The npm package is a ~1 KB loader: it loads `widget.js` from unpkg (the same version as the
package) and queues calls until the script is there, so `snipet.*` is safe to call right away.
Self-hosting the script? Pass its URL: `snipet.init(config, "/assets/widget.js")`.

## Signing in end users

The widget chats as an end user of a Snipet app. Two ways to get one:

- **Anonymous:** turn on anonymous access for the app and pass only `appId`. The widget creates an
  anonymous user and keeps it in `localStorage`, so the same visitor gets their chats back.
- **Your users:** your backend issues a token with your app's API key, and you hand it to the widget.

  ```bash
  curl -X POST https://snipet.example.com/api/apps/issue-token \
    -H "X-API-Key: <app api key>" -H "Content-Type: application/json" \
    -d '{ "externalUserId": "user-123", "name": "Ada", "email": "ada@example.com" }'
  # { "token": "...", "expiresAt": "..." }
  ```

  ```ts
  snipet.init({
    apiUrl,
    agentId,
    token,
    // Called when the token expires: return a fresh one, or null to sign out.
    getToken: () =>
      fetch("/my-backend/snipet-token")
        .then((r) => r.json())
        .then((r) => r.token),
  });
  ```

  Never ship the API key to the browser.

The API must allow your site's origin: set `CORS_ORIGINS` on the Snipet server.

## Options

| Option                                         | Type                            | Default   |                                                          |
| ---------------------------------------------- | ------------------------------- | --------- | -------------------------------------------------------- |
| `apiUrl`                                       | `string`                        | required  | Snipet server URL.                                       |
| `appId`                                        | `string`                        |           | App id; enables anonymous mode when no `token` is given. |
| `agentId`                                      | `string`                        |           | Agent to chat with.                                      |
| `token`                                        | `string`                        |           | End-user app token.                                      |
| `getToken`                                     | `() => Promise<string \| null>` |           | Renews `token` when it's rejected.                       |
| `theme`                                        | `"light" \| "dark" \| "auto"`   | `"light"` | `auto` follows the OS.                                   |
| `size`                                         | `"sm" \| "md" \| "lg"`          | `"md"`    | Overall scale.                                           |
| `radius`                                       | `number`                        | `16`      | Panel corner radius, px.                                 |
| `primaryColor`, `backgroundColor`, `textColor` | `string`                        |           | Any CSS color.                                           |
| `css`                                          | `string`                        |           | CSS injected into the shadow root.                       |
| `cssUrl`                                       | `string`                        |           | Stylesheet loaded into the shadow root.                  |
| `open`                                         | `boolean`                       | `false`   | Start with the panel open.                               |
| `enabled`                                      | `boolean`                       | `true`    | Show the widget at all.                                  |

## API

```ts
SnipetWidget.init(config); // mount; on a mounted widget, same as configure()
SnipetWidget.destroy(); // unmount and reset the config
SnipetWidget.open();
SnipetWidget.close();
SnipetWidget.toggle();
SnipetWidget.enable();
SnipetWidget.disable(); // hide the widget entirely
SnipetWidget.configure(patch); // change any option
SnipetWidget.setToken(token); // e.g. after your user logs in; null to sign out
const off = SnipetWidget.on("message", (message) => {}); // returns the unsubscribe
```

### Events

| Event     | Payload                                                                  |
| --------- | ------------------------------------------------------------------------ |
| `open`    |                                                                          |
| `close`   |                                                                          |
| `message` | `{ role: "user" \| "assistant", text, sessionId }`, once per new message |
| `error`   | `{ message }`: a failed request, stream or sign-in                       |

## Styling

From lightest to heaviest:

1. CSS variables, from your page: `snipet-widget { --sw-accent: tomato; }`. Variables: `--sw-accent`,
   `--sw-accent-text`, `--sw-surface`, `--sw-text`, `--sw-muted`, `--sw-border`, `--sw-header`,
   `--sw-header-text`, `--sw-input`, `--sw-shadow`, `--sw-font`, `--sw-radius`, `--sw-scale`.
2. Parts, from your page: `snipet-widget::part(launcher) { bottom: 80px; }`. Parts: `root`, `panel`,
   `header`, `body`, `message`, `user`, `assistant`, `composer`, `input`, `send`, `launcher`,
   `sessions`, `session`.
3. The `css` / `cssUrl` options, which load inside the shadow root and can restyle any `.sw-*` class.

## Development

```bash
pnpm dev     # dev host page on :5174, against an API on :8852
pnpm build   # dist/widget.js (the IIFE) + dist/loader.js and its types
```

The widget is React code rendered with Preact (aliased in `vite.config.ts`) to keep the bundle small.
