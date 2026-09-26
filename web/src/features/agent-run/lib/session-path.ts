import { applyPathParams } from "@/lib/http";
import { ROUTES } from "@/routes";

export const sessionPath = (sessionId: string) => applyPathParams(ROUTES.agentPlaygroundSession, { sessionId });
