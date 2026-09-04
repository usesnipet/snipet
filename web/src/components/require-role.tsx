import { Navigate } from "react-router";

import { useCurrentUser } from "@/features/auth/hooks";
import { ROUTES } from "@/routes";

import type { Role } from "@/models/user";

export function RequireRole({ role, children }: { role: Role; children: React.ReactNode }) {
  const user = useCurrentUser();

  if (user?.role !== role) {
    return <Navigate to={ROUTES.home} replace />;
  }

  return <>{children}</>;
}
