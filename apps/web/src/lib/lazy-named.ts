import { lazy } from "react";

import type { ComponentType } from "react";

/**
 * `React.lazy` for a named export: the module is only downloaded the first
 * time the component renders. Render it under a `Suspense` boundary.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- React.lazy itself is typed on ComponentType<any>.
export function lazyNamed<Name extends string, Component extends ComponentType<any>>(
  load: () => Promise<Record<Name, Component>>,
  name: Name,
) {
  return lazy(() => load().then((module) => ({ default: module[name] })));
}
