export const ROUTES = {
  login: "/login",
  chat: "/",
  chatSession: "/{sessionId}",
  agents: "/admin/agents",
  agentNew: "/admin/agents/new",
  agent: "/admin/agents/{agentId}",
  llmConnections: "/admin/llm/connections",
  llmPlayground: "/admin/llm/playground",
  plugins: "/admin/plugins",
  apps: "/admin/apps",
  users: "/admin/users",
  apiKey: "/admin/api-keys",
  settings: "/admin/settings",
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];
