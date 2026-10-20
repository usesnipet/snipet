# @snipet/angular-widget

Angular bindings for the [Snipet chat widget](https://github.com/usesnipet/snipet/tree/main/apps/widget). Angular 19+.

```bash
npm install @snipet/angular-widget
```

## Usage

Provide the widget when the app starts; it mounts in the page corner.

```ts
// app.config.ts
import { provideSnipet } from "@snipet/angular-widget";

export const appConfig: ApplicationConfig = {
  providers: [
    provideSnipet({
      apiUrl: "https://snipet.example.com",
      appId: "<your app id>",
      agentId: "<your agent id>",
      theme: "auto",
    }),
  ],
};
```

The config takes the widget's [options](https://github.com/usesnipet/snipet/tree/main/apps/widget#options). An optional second argument
overrides where the widget script loads from (default: unpkg, same version as this package).

Control it anywhere with the `SNIPET` token:

```ts
import { DestroyRef, inject } from "@angular/core";
import { SNIPET } from "@snipet/angular-widget";

export class HelpButtonComponent {
  private snipet = inject(SNIPET);

  constructor() {
    const off = this.snipet.on("message", (message) => console.log(message.role, message.text));
    inject(DestroyRef).onDestroy(off);
  }

  open() {
    this.snipet.open();
  }
}
```

`SNIPET` has `open`, `close`, `toggle`, `enable`, `disable`, `configure`, `setToken` and
`on` (see [events](https://github.com/usesnipet/snipet/tree/main/apps/widget#events)). Calls made before the script loads are queued.

### Signed-in users

Pass the token once you have it:

```ts
this.snipet.setToken(token); // null signs the user out
this.snipet.configure({ getToken: () => firstValueFrom(this.api.snipetToken()) });
```

Issue tokens from your backend; see [signing in end users](https://github.com/usesnipet/snipet/tree/main/apps/widget#signing-in-end-users).

SSR-safe: on the server the widget doesn't mount and `SNIPET` calls do nothing.
