import { useCurrentUser } from "@/features/auth/hooks";
import { ROUTES } from "@/routes";
import { hasRole, Role } from "@snipet/shared";
import { Navigate, Outlet } from "react-router";

export function RequireRole({ role }: { role: Role | Role[] }) {
  const user = useCurrentUser();
  const roles = Array.isArray(role) ? role : [role];

  if (hasRole(user?.role, roles)) return <Navigate to={ROUTES.home} replace />;
  return <Outlet />;
}
