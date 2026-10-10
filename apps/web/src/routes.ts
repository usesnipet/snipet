export const ROUTES = {
  login: "/login",
  home: "/",
  agents: "/agents",
  agentPlayground: "/agents/playground",
  agentPlaygroundSession: "/agents/playground/{sessionId}",
  llmConnections: "/llm/connections",
  llmPlayground: "/llm/playground",
  plugins: "/plugins",
  apps: "/apps",
  knowledge: "/knowledge",
  connections: "/connections",
  settings: "/settings",
  users: "/users",
  apiKey: "/api-keys"
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];
