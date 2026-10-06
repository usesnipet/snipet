import { applyPathParams } from "@snipet/client";
import { ROUTES } from "@/routes";

export const sessionPath = (sessionId: string) => applyPathParams(ROUTES.agentPlaygroundSession, { sessionId });
