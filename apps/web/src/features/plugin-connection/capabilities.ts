import { ALL_HOOKS, HOOK_ACTIONS, HookAction, HookMode } from "@snipet/shared/core";

import type { HookHandler, HookName, HooksCapability, PluginManifest } from "@snipet/shared/core";

/** Badges for what a plugin does. */
export function capabilityLabels({ capabilities }: PluginManifest): string[] {
  return [
    capabilities.tools && "Tools",
    capabilities.instructions && "Instructions",
    capabilities.hooks && "Hooks",
  ].filter((label): label is string => !!label);
}

/** The plugin's handlers, in the order their hooks happen in a run. */
export function handlersOf(hooks: HooksCapability): [HookName, HookHandler][] {
  return ALL_HOOKS.flatMap((hook): [HookName, HookHandler][] => {
    const handler = hooks.handlers[hook];
    return handler ? [[hook, handler]] : [];
  });
}

/**
 * What a handler can do on its hook, e.g. "can deny · can stop the run · required".
 * A background handler's reply is ignored, so it only observes.
 */
export function describeHandler(hook: HookName, { mode, optional }: HookHandler): string {
  const actions = mode === HookMode.BACKGROUND ? [] : HOOK_ACTIONS[hook];
  const parts = [
    actions.includes(HookAction.MODIFY) && "can modify",
    actions.includes(HookAction.RESPOND) && "can answer",
    actions.includes(HookAction.DENY) && "can deny",
    actions.includes(HookAction.STOP) && "can stop the run",
    mode === HookMode.BACKGROUND && "observes in background",
    mode !== HookMode.BACKGROUND && !actions.some((action) => action !== HookAction.CONTINUE) && "observes",
    !optional && "required",
  ];
  return parts.filter(Boolean).join(" · ");
}
