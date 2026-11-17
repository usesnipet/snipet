import { isPlatformBrowser } from "@angular/common";
import {
  DestroyRef,
  InjectionToken,
  PLATFORM_ID,
  inject,
  makeEnvironmentProviders,
  provideEnvironmentInitializer,
} from "@angular/core";
import { snipet } from "@snipet/widget";

import type { EnvironmentProviders } from "@angular/core";
import type { Snipet, WidgetInit } from "@snipet/widget";

export type * from "@snipet/widget";

/** The widget's API: `inject(SNIPET).open()`. Safe to call before the widget loads, and on the server (no-op). */
export const SNIPET = new InjectionToken<Snipet>("SNIPET", { providedIn: "root", factory: () => snipet });

/**
 * Mounts the chat widget when the app starts (in the browser only) and unmounts it with the app.
 * `src` overrides where the widget script loads from; defaults to the CDN build of the installed version.
 */
export function provideSnipet(config: WidgetInit, src?: string): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideEnvironmentInitializer(() => {
      if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
      snipet.init(config, src);
      inject(DestroyRef).onDestroy(() => snipet.destroy());
    }),
  ]);
}
