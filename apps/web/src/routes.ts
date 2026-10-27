export const ROUTES = {
  login: "/login",
  home: "/",
  agents: "/agents",
  agentPlayground: "/agents/playground",
  agentPlaygroundSession: "/agents/playground/{sessionId}",
  llmConnections: "/llm/connections",
  llmPlayground: "/llm/playground",
  plugins: "/plugins",
  hooks: "/hooks",
  apps: "/apps",
  users: "/users",
  apiKey: "/api-keys",
  settings: "/settings"
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];
