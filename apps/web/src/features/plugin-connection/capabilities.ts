import type { HookHandler, PluginManifest } from "@snipet/shared";

/** Badges for what a plugin does. */
export function capabilityLabels({ capabilities }: PluginManifest): string[] {
  return [
    capabilities.actions && "Tools",
    capabilities.instructions && "Instructions",
    capabilities.hooks && "Hooks",
  ].filter((label): label is string => !!label);
}

/** What a handler can do on its hook, e.g. "modifies · can stop the run · runs in background". */
export function describeHandler({ actions, background, optional }: HookHandler): string {
  const parts = [
    actions.includes("modify") && "modifies",
    actions.includes("respond") && "can answer",
    actions.includes("deny") && "can deny",
    actions.includes("stop") && "can stop the run",
    background && "runs in background",
    !actions.length && !background && "observes",
    !optional && "required",
  ];
  return parts.filter(Boolean).join(" · ");
}
