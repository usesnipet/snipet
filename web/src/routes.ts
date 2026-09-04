export const ROUTES = {
  home: "/",
  agents: "/agents",
  llmConnections: "/llm-connections",
  knowledge: "/knowledge",
  connections: "/connections",
  settings: "/settings",
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];
