# @snipet/react-widget

React bindings for the [Snipet chat widget](https://github.com/usesnipet/snipet/tree/main/apps/widget).

```bash
npm install @snipet/react-widget
```

## Usage

Render `<SnipetWidget />` once, anywhere in your app. It draws the widget in the page corner and
renders nothing in place.

```tsx
import { SnipetWidget, useSnipet } from "@snipet/react-widget";

export function App() {
  return (
    <>
      <SnipetWidget
        apiUrl="https://snipet.example.com"
        appId="<your app id>"
        agentId="<your agent id>"
        theme="auto"
        onMessage={(message) => console.log(message.role, message.text)}
      />
      <HelpButton />
    </>
  );
}

function HelpButton() {
  const snipet = useSnipet();
  return <button onClick={() => snipet.open()}>Help</button>;
}
```

- Props are the widget's [options](https://github.com/usesnipet/snipet/tree/main/apps/widget#options); changing one updates the widget.
- Events: `onOpen`, `onClose`, `onMessage`, `onError` (see [events](https://github.com/usesnipet/snipet/tree/main/apps/widget#events)).
- `src` overrides where the widget script loads from (default: unpkg, same version as this package).
- Unmounting `<SnipetWidget />` removes the widget.

`useSnipet()` returns the widget API: `open`, `close`, `toggle`, `enable`, `disable`, `configure`,
`setToken`, `on`. Calls made before the script loads are queued.

### Signed-in users

```tsx
<SnipetWidget apiUrl={apiUrl} agentId={agentId} token={user?.snipetToken} getToken={refreshSnipetToken} />
```

Issue tokens from your backend; see [signing in end users](https://github.com/usesnipet/snipet/tree/main/apps/widget#signing-in-end-users).
Keep `getToken` stable (`useCallback` or a module function) so the widget isn't reconfigured on every render.

Works with SSR frameworks (Next.js, Remix): the component is a client component and only touches the
DOM in effects.
