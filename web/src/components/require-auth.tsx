import { Navigate, useLocation } from "react-router";

import { useIsAuthenticated } from "@/features/auth/hooks";
import { ROUTES } from "@/routes";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useIsAuthenticated();
  const location = useLocation();

  if (!isAuthenticated) {
    const redirect = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`${ROUTES.login}?redirect=${redirect}`} replace />;
  }

  return <>{children}</>;
}
