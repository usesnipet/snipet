import { useIsAuthenticated } from "@/features/auth/hooks";
import { ROUTES } from "@/routes";
import { Navigate, Outlet, useLocation } from "react-router";

export function RequireAuth() {
  const isAuthenticated = useIsAuthenticated();
  const location = useLocation();

  if (!isAuthenticated) {
    const redirect = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`${ROUTES.login}?redirect=${redirect}`} replace />;
  }

  return <Outlet />;
}
