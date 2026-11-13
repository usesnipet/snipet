import { applyPathParams } from "@snipet/client";
import { ROUTES } from "@/routes";

/** URL of a chat; agentId keeps the chat list filtered by that agent. */
export const sessionPath = (sessionId: string, agentId?: string) => {
  const path = applyPathParams(ROUTES.chatSession, { sessionId });
  return agentId ? `${path}?agent=${agentId}` : path;
};
