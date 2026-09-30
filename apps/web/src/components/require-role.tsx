import { useCurrentUser } from "@/features/auth/hooks";
import { ROUTES } from "@/routes";
import { Navigate, Outlet } from "react-router";

import type { Role } from "@/models/user";

export function RequireRole({ role }: { role: Role }) {
  const user = useCurrentUser();

  if (user?.role !== role) {
    return <Navigate to={ROUTES.home} replace />;
  }

  return <Outlet />;
}
