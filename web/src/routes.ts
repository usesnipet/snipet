export const ROUTES = {
  home: "/",
  agents: "/agents",
  llmProviders: "/llm-providers",
  knowledge: "/knowledge",
  connections: "/connections",
  settings: "/settings",
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];
