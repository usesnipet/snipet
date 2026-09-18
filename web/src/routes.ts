export const ROUTES = {
  login: "/login",
  home: "/",
  agents: "/agents",
  llmConnections: "/llm/connections",
  llmPlayground: "/llm/playground",
  knowledge: "/knowledge",
  connections: "/connections",
  settings: "/settings",
  users: "/users",
  apiKey: "/api-keys"
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];
