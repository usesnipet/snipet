import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router";

import { LoadingFallback } from "./components/loading-fallback";
import { RequireRole } from "./components/require-role";
import { ROUTES } from "./routes";

import type { RoutePath } from "./routes";

const Layout = lazy(() =>
  import("./routes/layout").then((m) => ({ default: m.Layout })));
const LoginPage = lazy(() =>
  import("./routes/login/page").then((m) => ({ default: m.LoginPage })));
const HomePage = lazy(() =>
  import("./routes/page").then((m) => ({ default: m.HomePage })));
const LlmConnectionsPage = lazy(() =>
  import("./routes/llm-connections/page").then((m) => ({ default: m.LlmConnectionsPage })));
const PlaceholderPage = lazy(() =>
  import("./routes/placeholder/page").then((m) => ({ default: m.PlaceholderPage })));
const UsersPage = lazy(() =>
  import("./routes/users/page").then((m) => ({ default: m.UsersPage })));

const toReactRouterPath = (path: RoutePath) => {
  return path.replaceAll(/{([^}]+)}/g, (_, p1) => `:${p1}`);
}

export const Router = () => {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingFallback className="min-h-svh" />}>
        <Routes>
          <Route path={toReactRouterPath(ROUTES.login)} element={<LoginPage />} />
          <Route element={<Layout />}>
            <Route path={toReactRouterPath(ROUTES.home)} element={<HomePage />} />
            <Route path={toReactRouterPath(ROUTES.agents)} element={<PlaceholderPage title="Agents" />} />
            <Route path={toReactRouterPath(ROUTES.llmConnections)} element={<LlmConnectionsPage />} />
            <Route path={toReactRouterPath(ROUTES.knowledge)} element={<PlaceholderPage title="Knowledge" />} />
            <Route path={toReactRouterPath(ROUTES.connections)} element={<PlaceholderPage title="Connections" />} />
            <Route path={toReactRouterPath(ROUTES.settings)} element={<PlaceholderPage title="Settings" />} />
            <Route
              path={toReactRouterPath(ROUTES.users)}
              element={<RequireRole role="admin"><UsersPage /></RequireRole>}
            />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
