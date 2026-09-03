export const ROUTES = {
  home: "/",
  llmProviders: "/llm-providers",
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];
