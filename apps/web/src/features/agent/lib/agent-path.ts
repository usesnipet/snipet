import { applyPathParams } from "@snipet/client";
import { ROUTES } from "@/routes";

/** URL of the page that edits this agent. */
export const agentPath = (agentId: string) => applyPathParams(ROUTES.agent, { agentId });
